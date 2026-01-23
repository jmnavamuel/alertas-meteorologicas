#!/usr/bin/env python3
import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path

import requests
import tarfile
import shutil
import os
import csv
import re
import unicodedata
import csv
import re
import unicodedata

AEMET_API_KEY = os.getenv('AEMET_API_KEY')
AEMET_BASE = 'https://opendata.aemet.es/opendata/api'
# Guardar en la carpeta indicada por env `ALERTAS_DIR` o por defecto `data/alertas`
DEFAULT_ALERTAS = Path(__file__).resolve().parents[2] / 'data' / 'alertas'
DATA_DIR = Path(os.getenv('ALERTAS_DIR') or str(DEFAULT_ALERTAS))

# Por defecto, no escribir ficheros de depuración en `data/alertas/debug`.
# Para habilitarlos exporta `ALERTAS_DEBUG=1` en el entorno del contenedor.
WRITE_DEBUG = os.getenv('ALERTAS_DEBUG', '0') in ('1', 'true', 'True')

# Lock file to avoid concurrent runs (helps si el contenedor se lanza varias veces)
LOCK_FILE = DATA_DIR / '.fetch_lock'
LOCK_STALE_SECONDS = 1800  # considerar stale si tiene más de 30min

def acquire_lock():
    """Try to create a lock file atomically. Returns True if lock acquired, False otherwise."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        # Use os.open with O_EXCL to ensure atomic creation
        fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        try:
            os.write(fd, f"pid:{os.getpid()}\n".encode('utf-8'))
        finally:
            os.close(fd)
        return True
    except FileExistsError:
        try:
            mtime = LOCK_FILE.stat().st_mtime
            if time.time() - mtime > LOCK_STALE_SECONDS:
                try:
                    LOCK_FILE.unlink()
                except Exception:
                    return False
                # retry once
                return acquire_lock()
        except Exception:
            pass
        return False

def release_lock():
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except Exception:
        pass


def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def recent_download_exists(max_age_seconds=3600):
    """Devuelve True si ya existe un JSON o paquete en DATA_DIR modificado en las últimas `max_age_seconds` segundos."""
    now = time.time()
    patterns = ('aemet-response-', 'aemet-ultimoelaborado-', '')
    try:
        for entry in DATA_DIR.iterdir():
            if not entry.is_file():
                continue
            # considerar solo ficheros relevantes: json, tar, gz, zip
            if not entry.suffix.lower() in ('.json', '.tar', '.gz', '.zip') and 'aemet' not in entry.name:
                continue
            mtime = entry.stat().st_mtime
            if now - mtime < max_age_seconds:
                print(f"⏱️  Archivo reciente encontrado: {entry.name} (omitimos descarga)")
                return True
    except Exception:
        pass
    return False


def mask_key(key: str) -> str:
    if not key:
        return '***NO_KEY***'
    if len(key) > 8:
        return key[:4] + '...' + key[-4:]
    return '***'


def fetch_json():
    if not AEMET_API_KEY:
        print('❌ AEMET_API_KEY no configurada. Exporta AEMET_API_KEY en el entorno.')
        return 1

    # Asegurar carpeta y limpieza de debug/tmp antes de arrancar
    ensure_data_dir()
    # evitar ejecuciones concurrentes
    locked = acquire_lock()
    if not locked:
        print('⏳ Otra instancia en ejecución. Se omite esta ejecución.')
        return 0
    try:
        clean_debug_and_tmp()

        # Si ya hay una descarga reciente (JSON O tar.gz dentro de la última hora), omitir
        if recent_download_exists(max_age_seconds=3600):
            print('⏱️  Descarga reciente encontrada, omitiendo sincronización')
            return 0

        endpoints = [
            f"{AEMET_BASE}/avisos_cap/activos/area/esp?api_key={AEMET_API_KEY}",
            f"{AEMET_BASE}/avisos_cap/ultimoelaborado/area/esp?api_key={AEMET_API_KEY}"
        ]

        # Intentar descargar nuevo JSON
        json_path = None
        for idx, url in enumerate(endpoints, start=1):
            try:
                print(f"📡 Descargando JSON AEMET (opción {idx}): {url.replace(AEMET_API_KEY, mask_key(AEMET_API_KEY))}")
                resp = requests.get(url, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('estado') and data.get('datos'):
                        ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
                        out_file = DATA_DIR / f'aemet-response-{ts}.json'
                        with open(out_file, 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                        print(f"✅ Guardado JSON en: {out_file}")

                        # mantener únicamente el último JSON
                        try:
                            for f in DATA_DIR.glob('aemet-response-*.json'):
                                if f.resolve() != out_file.resolve():
                                    try:
                                        f.unlink()
                                    except Exception:
                                        pass
                        except Exception:
                            pass

                        json_path = out_file
                        break
                    else:
                        print('⚠️  Respuesta API sin campos esperados (estado/datos)')
                else:
                    print(f'⚠️  HTTP {resp.status_code} al consultar {url}')
            except requests.RequestException as e:
                print(f'❌ Error petición: {e}')

        if not json_path:
            print('❌ No se pudo obtener el JSON de AEMET (todas las opciones fallaron)')
            return 2

        # Intentar descargar el tar.gz indicado en el campo 'datos' del JSON seleccionado
        try:
            with open(json_path, 'r', encoding='utf-8') as jf:
                data = json.load(jf)

            datos_url = data.get('datos')
            if isinstance(datos_url, list):
                datos_url = datos_url[0] if datos_url else None

            if datos_url:
                print(f"📥 Descargando paquete de alertas: {datos_url}")
                ok = download_tar(datos_url, json_path.stem)
                if not ok:
                    print('❌ Falló la descarga/extracción del paquete de alertas')
                    return 3
            else:
                print('⚠️  El campo "datos" no contiene URL válida')
                return 4
        except Exception as e:
            print('❌ Error leyendo JSON local:', e)
            return 5

    finally:
        release_lock()
    return 0


def download_tar(url: str, prefix: str = 'aemet'):
    """Descarga un tar.gz desde la URL indicada y guarda en DATA_DIR.
    Por defecto no guarda cabeceras de depuración en `data/alertas/debug`.
    Si se exporta `ALERTAS_DEBUG=1` se crearán esos ficheros.
    """

    try:
        with requests.get(url, stream=True, timeout=60, allow_redirects=True) as r:
            status = r.status_code
            ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
            headers_file = None
            if WRITE_DEBUG:
                debug_dir = DATA_DIR / 'debug'
                debug_dir.mkdir(parents=True, exist_ok=True)
                headers_file = debug_dir / f'headers-{ts}.txt'
                with open(headers_file, 'w', encoding='utf-8') as hf:
                    hf.write(f'STATUS: {status}\n')
                    for k, v in r.headers.items():
                        hf.write(f'{k}: {v}\n')

            if status != 200:
                if headers_file:
                    print(f'⚠️  No se pudo descargar el archivo (HTTP {status}). Headers guardadas en: {headers_file}')
                else:
                    print(f'⚠️  No se pudo descargar el archivo (HTTP {status}).')
                return False

            # Determinar nombre de archivo
            url_path = url.split('?')[0]
            filename = url_path.split('/')[-1] or f'{prefix}-{ts}.tar.gz'
            out_path = DATA_DIR / filename

            # Guardar contenido en streaming
            total = 0
            with open(out_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)

            # Detectar formato real leyendo cabecera
            final_path = out_path
            is_gzip = False
            is_tar = False
            try:
                with open(final_path, 'rb') as fh:
                    head = fh.read(4)
                    # gzip magic 1f 8b
                    if len(head) >= 2 and head[0] == 0x1f and head[1] == 0x8b:
                        is_gzip = True
                    # verificar magic 'ustar' en offset 257
                    fh.seek(257)
                    ustar = fh.read(5)
                    if ustar == b'ustar':
                        is_tar = True
            except Exception:
                pass

            # Renombrado informativo según formato detectado
            try:
                if is_gzip and not str(final_path).lower().endswith('.gz'):
                    newp = final_path.with_name(final_path.name + '.gz')
                    shutil.move(str(final_path), str(newp))
                    final_path = newp
                elif is_tar and not (str(final_path).lower().endswith('.tar') or str(final_path).lower().endswith('.tar.gz')):
                    newp = final_path.with_name(final_path.name + '.tar')
                    shutil.move(str(final_path), str(newp))
                    final_path = newp
            except Exception:
                pass

            print(f"✅ Archivo guardado en: {final_path} ({total} bytes) -- gzip={is_gzip} tar={is_tar}")

            # Extraer en DATA_DIR/tmp (limpiando previamente)
            tmp_dir = DATA_DIR / 'tmp'
            try:
                if tmp_dir.exists():
                    shutil.rmtree(tmp_dir)
                tmp_dir.mkdir(parents=True, exist_ok=True)
                print(f"📦 Extrayendo {final_path.name} a {tmp_dir} (modo automático)")
                with tarfile.open(final_path, 'r:*') as tarf:
                    tarf.extractall(path=tmp_dir)
                print(f"✅ Extracción completada en: {tmp_dir}")
            except tarfile.ReadError:
                print(f"⚠️  Archivo {final_path} no es un tar válido o está corrupto (ReadError)")
            except Exception as e:
                print(f"❌ Error extrayendo archivo: {e}")

            # Después de extraer, parsear XML/CAP y generar CSV único (no verdes)
            try:
                parse_tmp_and_write_raw_csv(tmp_dir)
            except Exception as e:
                print('❌ Error parsing XML/CAP:', e)

            return True
    except requests.RequestException as e:
        print('❌ Error descargando tar.gz:', e)
        return False


def normalize_text(s: str) -> str:
    if not s:
        return ''
    s = unicodedata.normalize('NFD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower()


PROVINCIAS = {
    '01': 'Araba/Álava', '02': 'Albacete', '03': 'Alicante/Alacant', '04': 'Almería',
    '05': 'Ávila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona',
    '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón/Castelló',
    '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca',
    '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa',
    '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
    '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
    '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense',
    '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
    '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia',
    '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
    '45': 'Toledo', '46': 'Valencia/València', '47': 'Valladolid', '48': 'Bizkaia',
    '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla'
}

PROVINCIAS_NORM = {normalize_text(v): k for k, v in PROVINCIAS.items()}
PROV_NAMES = list(PROVINCIAS_NORM.keys())


def extract_entries_from_xml(xml_content: str):
    import xml.etree.ElementTree as ET
    entries = []
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        return entries

    # Buscar nodos relevantes: entry, alert, item, info
    candidates = []
    for tag in ['entry', 'alert', 'item', 'info']:
        candidates.extend(root.findall('.//{}'.format(tag)))

    # Si no hay nodos, tratar todo el documento como una entrada
    if not candidates:
        candidates = [root]

    for node in candidates:
        texts = []
        for elem in node.iter():
            if elem.text:
                texts.append(elem.text)
            if elem.tail:
                texts.append(elem.tail)
        full = ' '.join(t.strip() for t in texts if t and t.strip())
        entries.append(full)

    return entries


def detect_level(text: str) -> str:
    t = text.lower()
    if re.search(r'rojo|extremo|riesgo extremo|nivel\s*4', t):
        return 'rojo'
    if re.search(r'naranja|importante|nivel\s*3', t):
        return 'naranja'
    if re.search(r'amarillo|advertencia|riesgo|nivel\s*2', t):
        return 'amarillo'
    return 'verde'


def detect_province(text: str):
    tn = normalize_text(text)
    for name in PROV_NAMES:
        if name in tn:
            return PROVINCIAS_NORM[name]
        # try first word
        if name.split('/')[0].split(' ')[0] and name.split('/')[0].split(' ')[0] in tn:
            return PROVINCIAS_NORM[name]
    # buscar código provincia en texto
    m = re.search(r'\b([0-5][0-9])\b', text)
    if m and m.group(1) in PROVINCIAS:
        return m.group(1)
    return None


def detect_phenomenon(text: str):
    # Buscar por ... en / alerta por ...
    m = re.search(r'por\s+([^,.;\n]+?)\s+(?:en|$)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().capitalize()
    # keywords
    keywords = ['viento', 'lluvia', 'nieve', 'niebla', 'tormenta', 'ola de calor', 'helada', 'fenomenos costeros', 'nevadas']
    t = text.lower()
    for k in keywords:
        if k in t:
            return k.capitalize()
    return None


def extract_start_date(text: str):
    """Intentar extraer la fecha/hora de inicio del evento desde el texto.
    Busca datetimes ISO8601 y devuelve la primera encontrada como ISO str.
    """
    if not text:
        return None
    # buscar patrones ISO8601 como 2026-01-22T10:19:14+01:00 o Z
    m = re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?", text)
    if m:
        dt = m.group(0)
        # normalize Z -> +00:00 and ensure timezone colon
        if dt.endswith('Z'):
            dt = dt.replace('Z', '+00:00')
        # ensure offset like +0100 -> +01:00 (insert colon if missing)
        m2 = re.match(r"(.*[0-9])([+-]\d{2})(\d{2})$", dt)
        if m2:
            dt = f"{m2.group(1)}{m2.group(2)}:{m2.group(3)}"
        return dt
    return None


def _parse_iso_or_min(s: str):
    from datetime import datetime
    if not s:
        return datetime.min
    try:
        # replace Z with +00:00 for fromisoformat
        s2 = s.replace('Z', '+00:00')
        return datetime.fromisoformat(s2)
    except Exception:
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return datetime.min


def parse_tmp_and_write_csv(tmp_dir: Path):
    # Localizar todos los archivos XML/CAP dentro de tmp_dir
    files = []
    for root, _, filenames in os.walk(tmp_dir):
        for fn in filenames:
            if fn.lower().endswith(('.xml', '.cap')) or fn.lower().endswith('.xml.gz'):
                files.append(os.path.join(root, fn))

    if not files:
        print('⚠️  No se encontraron archivos XML/CAP en tmp para procesar')
        return

    alertas_por_subprov = {}
    priority = {'verde': 1, 'amarillo': 2, 'naranja': 3, 'rojo': 4}

    # regex para intentar extraer subprovincia/zona/area de texto
    subprov_regex = re.compile(r"\b(?:zona|área|area|sector|zona de|área de|sector de)\s*(?:de\s*)?([A-Za-zÁÉÍÓÚáéíóúñÑ0-9 \-\/]+?)(?:[\.,;\n]|$)", re.IGNORECASE)

    for fpath in files:
        try:
            with open(fpath, 'rb') as fh:
                raw = fh.read()
            try:
                text = raw.decode('utf-8')
            except Exception:
                try:
                    text = raw.decode('latin1')
                except Exception:
                    text = ''

            entries = extract_entries_from_xml(text)

            for entry in entries:
                nivel = detect_level(entry)
                if nivel == 'verde':
                    continue  # filtrar verdes

                # excluir avisos costeros
                fenomeno_check = detect_phenomenon(entry) or ''
                if is_coastal(fenomeno_check) or is_coastal(entry):
                    continue

                prov = detect_province(entry)
                # intentar extraer subprovincia (zona/área)
                subprov = None
                m = subprov_regex.search(entry)
                if m:
                    subprov = m.group(1).strip()

                if not subprov:
                    # si no hay subprov detectada, intentar extraer frase después de 'en' como fallback
                    m2 = re.search(r'en\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9 \,\-]+?)(?:[\.,;\n]|$)', entry, re.IGNORECASE)
                    if m2:
                        subprov = m2.group(1).strip()

                # Detección específica de 'meseta' (meseta de soria / meseta de segovia)
                if not subprov:
                    mm = re.search(r'meseta\s+de\s*(soria|segovia)', entry, re.IGNORECASE)
                    if mm:
                        subprov = f"Meseta de {mm.group(1).capitalize()}"

                # Si sigue sin subprov y la provincia es Ávila (05), intentar mapear por menciones
                if not subprov and prov == '05':
                    if re.search(r'\bsoria\b', entry, re.IGNORECASE):
                        subprov = 'Meseta de Soria'
                    elif re.search(r'\bsegovia\b', entry, re.IGNORECASE):
                        subprov = 'Meseta de Segovia'

                if not prov and not subprov:
                    continue

                fenomeno = detect_phenomenon(entry) or 'null'
                ts = datetime.utcnow().isoformat()

                key = f"{prov or '00'}::{subprov or 'general'}"
                current = alertas_por_subprov.get(key)
                if not current or priority[nivel] > priority[current['nivel']]:
                    alertas_por_subprov[key] = {
                        'prov': prov,
                        'subprov': subprov,
                        'nivel': nivel,
                        'fenomeno': fenomeno,
                        'timestamp': ts
                    }
        except Exception as e:
            print('⚠️  Error procesando', fpath, e)

    if not alertas_por_subprov:
        print('⚠️  No se detectaron alertas (no verdes) tras procesar XMLs')
        return

    # Escribir CSV en data/alertas/alertas-YYYYMMDD-HHMM.csv
    now = datetime.utcnow().strftime('%Y%m%d-%H%M')
    out_dir = Path(__file__).resolve().parents[2] / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f'alertas-{now}.csv'
    with open(out_file, 'w', encoding='utf-8', newline='') as csvf:
        writer = csv.writer(csvf)
        writer.writerow(['codigo_provincia', 'nombre_provincia', 'subprovincia', 'nivel', 'fenomeno', 'timestamp'])
        for key in sorted(alertas_por_subprov.keys()):
            datos = alertas_por_subprov[key]
            codigo = datos['prov'] or ''
            nombre = PROVINCIAS.get(codigo, '')
            writer.writerow([codigo, nombre, datos['subprov'], datos['nivel'], datos['fenomeno'], datos['timestamp']])

    # eliminar otros alertas-*.csv en la carpeta `data/`, dejando solo el último
    try:
        for f in out_dir.glob('alertas-*.csv'):
            if f.resolve() != out_file.resolve():
                try:
                    f.unlink()
                except Exception:
                    pass
    except Exception:
        pass

    print(f"✅ CSV de alertas (no verdes) guardado en: {out_file}")


def parse_tmp_and_write_raw_csv(tmp_dir: Path):
    """Genera un CSV con todas las alertas (amarillo/naranja/rojo) sin agrupar.
    Columnas: codigo_provincia, nombre_provincia, subprovincia, nivel, fenomeno, timestamp, source_file, excerpt
    También genera alertas-latest.csv con formato simplificado para la API Node.js
    """
    files = []
    for root, _, filenames in os.walk(tmp_dir):
        for fn in filenames:
            if fn.lower().endswith(('.xml', '.cap')) or fn.lower().endswith('.xml.gz'):
                files.append(os.path.join(root, fn))

    if not files:
        print('⚠️  No se encontraron archivos XML/CAP en tmp para procesar (raw)')
        return

    rows = []
    # Agrupar alertas por provincia para el CSV simplificado
    alertas_por_provincia = {}
    
    for fpath in files:
        try:
            with open(fpath, 'rb') as fh:
                raw = fh.read()
            try:
                text = raw.decode('utf-8')
            except Exception:
                try:
                    text = raw.decode('latin1')
                except Exception:
                    text = ''

            entries = extract_entries_from_xml(text)
            for entry in entries:
                nivel = detect_level(entry)
                if nivel == 'verde':
                    continue
                # excluir avisos costeros
                fenomeno_check = detect_phenomenon(entry) or ''
                if is_coastal(fenomeno_check) or is_coastal(entry):
                    continue
                prov = detect_province(entry) or ''
                # intentar extraer subprovincia
                subprov = None
                m = re.search(r"\b(?:zona|área|area|sector|meseta)\s*(?:de\s*)?([A-Za-zÁÉÍÓÚáéíóúñÑ0-9 \-\/]+?)(?:[\.,;\n]|$)", entry, re.IGNORECASE)
                if m:
                    subprov = m.group(1).strip()
                if not subprov:
                    m2 = re.search(r'en\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9 \,\-]+?)(?:[\.,;\n]|$)', entry, re.IGNORECASE)
                    if m2:
                        subprov = m2.group(1).strip()

                fenomeno = detect_phenomenon(entry) or ''
                ts = datetime.utcnow().isoformat()
                # intentar extraer fecha de inicio del evento desde el contenido
                start = extract_start_date(entry) or ts
                excerpt = ' '.join(entry.split())[:300]
                rows.append([prov, PROVINCIAS.get(prov, ''), subprov, nivel, fenomeno, start, ts, os.path.basename(fpath), excerpt])
                
                # Guardar el nivel más alto por provincia
                if prov and prov not in alertas_por_provincia:
                    alertas_por_provincia[prov] = {
                        'nombre': PROVINCIAS.get(prov, ''),
                        'nivel': nivel,
                        'fenomeno': fenomeno,
                        'timestamp': ts
                    }
                elif prov:
                    # Actualizar si el nuevo nivel es más alto
                    niveles_orden = {'amarillo': 1, 'naranja': 2, 'rojo': 3}
                    if niveles_orden.get(nivel, 0) > niveles_orden.get(alertas_por_provincia[prov]['nivel'], 0):
                        alertas_por_provincia[prov]['nivel'] = nivel
                        alertas_por_provincia[prov]['fenomeno'] = fenomeno
                        alertas_por_provincia[prov]['timestamp'] = ts
        except Exception as e:
            print('⚠️  Error procesando (raw)', fpath, e)

    if not rows:
        print('⚠️  No se encontraron alertas (raw) tras procesar XMLs')
        return

    now = datetime.utcnow().strftime('%Y%m%d-%H%M')
    out_dir = Path(__file__).resolve().parents[2] / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f'alertas-{now}.csv'
    # ordenar por codigo provincia, luego por fecha de inicio (start)
    try:
        rows.sort(key=lambda r: (r[0] or '', _parse_iso_or_min(r[5])))
    except Exception:
        pass

    with open(out_file, 'w', encoding='utf-8', newline='') as csvf:
        writer = csv.writer(csvf)
        writer.writerow(['codigo_provincia', 'nombre_provincia', 'subprovincia', 'nivel', 'fenomeno', 'start', 'timestamp', 'source_file', 'excerpt'])
        for r in rows:
            writer.writerow(r)

    # Escribir CSV simplificado para la API Node.js
    latest_file = out_dir / 'alertas-latest.csv'
    with open(latest_file, 'w', encoding='utf-8', newline='') as csvf:
        writer = csv.writer(csvf)
        writer.writerow(['codigo_provincia', 'nombre_provincia', 'nivel', 'fenomeno', 'timestamp'])
        for codigo, datos in alertas_por_provincia.items():
            writer.writerow([
                codigo,
                datos['nombre'],
                datos['nivel'],
                datos.get('fenomeno') or 'null',
                datos['timestamp']
            ])

    # eliminar otros alertas-*.csv en la carpeta `data/`, dejando solo el último
    try:
        for f in out_dir.glob('alertas-*.csv'):
            if f.resolve() != out_file.resolve():
                try:
                    f.unlink()
                except Exception:
                    pass
    except Exception:
        pass

    print(f"✅ CSV de alertas (no verdes) guardado en: {out_file}")
    print(f"✅ CSV simplificado generado en: {latest_file}")


def clean_debug_and_tmp():
    try:
        d = DATA_DIR / 'debug'
        t = DATA_DIR / 'tmp'
        if d.exists() and d.is_dir():
            shutil.rmtree(d)
        if t.exists() and t.is_dir():
            shutil.rmtree(t)
        # recrear tmp vacía
        (DATA_DIR / 'tmp').mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


def latest_json_file():
    try:
        files = sorted(DATA_DIR.glob('aemet-response-*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
        return files[0] if files else None
    except Exception:
        return None


def is_coastal(text: str) -> bool:
    """Devuelve True si el texto indica aviso costero ('costero', 'costeros', 'coster')."""
    if not text:
        return False
    t = text.lower()
    return bool(re.search(r"\b(costero|costeros|coster)\b", t))


def main():
    ensure_data_dir()
    code = fetch_json()
    return code


if __name__ == '__main__':
    sys.exit(main())
