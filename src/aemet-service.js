const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const { XMLParser } = require('fast-xml-parser');
const AEMET_API_KEY = process.env.AEMET_API_KEY;
const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';
const DATA_DIR = path.join(__dirname, '../data');

const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

let estadoSincronizacion = {
  ultimaSincronizacion: null,
  estado: 'pendiente',
  mensaje: 'Esperando primera sincronización',
  totalConsultas: 0,
  consultasExitosas: 0,
  consultasFallidas: 0,
  archivoActual: null
};

const PROVINCIAS_AEMET = {
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
};

const CP_TO_PROVINCIA = {
  '01': '01', '02': '02', '03': '03', '04': '04', '05': '05',
  '06': '06', '07': '07', '08': '08', '09': '09', '10': '10',
  '11': '11', '12': '12', '13': '13', '14': '14', '15': '15',
  '16': '16', '17': '17', '18': '18', '19': '19', '20': '20',
  '21': '21', '22': '22', '23': '23', '24': '24', '25': '25',
  '26': '26', '27': '27', '28': '28', '29': '29', '30': '30',
  '31': '31', '32': '32', '33': '33', '34': '34', '35': '35',
  '36': '36', '37': '37', '38': '38', '39': '39', '40': '40',
  '41': '41', '42': '42', '43': '43', '44': '44', '45': '45',
  '46': '46', '47': '47', '48': '48', '49': '49', '50': '50',
  '51': '51', '52': '52'
};

const NIVELES_ALERTA = {
  verde: { color: '#28a745', nivel: 'verde', nombre: 'Sin riesgo' },
  amarillo: { color: '#ffc107', nivel: 'amarillo', nombre: 'Riesgo' },
  naranja: { color: '#fd7e14', nivel: 'naranja', nombre: 'Riesgo importante' },
  rojo: { color: '#dc3545', nivel: 'rojo', nombre: 'Riesgo extremo' }
};

// Mapeo de provincias AEMET a nombres en alertas
const MAPA_PROVINCIAS_ALERTAS = {
  'A Coruña': '15', 'Lugo': '27', 'Ourense': '32', 'Pontevedra': '36',
  'Asturias': '33', 'Cantabria': '39', 'Bizkaia': '48', 'Gipuzkoa': '20', 'Araba/Álava': '01',
  'Navarra': '31', 'La Rioja': '26', 'Burgos': '09', 'León': '24', 'Palencia': '34',
  'Zamora': '49', 'Valladolid': '47', 'Salamanca': '37', 'Ávila': '05', 'Segovia': '40',
  'Soria': '42', 'Madrid': '28', 'Guadalajara': '19', 'Cuenca': '16', 'Toledo': '45',
  'Cáceres': '10', 'Badajoz': '06', 'Huelva': '21', 'Sevilla': '41', 'Córdoba': '14',
  'Jaén': '23', 'Granada': '18', 'Almería': '04', 'Málaga': '29', 'Cádiz': '11',
  'Murcia': '30', 'Alacant/Alicante': '03', 'València/Valencia': '46', 'Castelló/Castellón': '12',
  'Tarragona': '43', 'Barcelona': '08', 'Lleida': '25', 'Girona': '17',
  'Illes Balears': '07', 'Menorca': '07', 'Mallorca': '07', 'Ibiza y Formentera': '07',
  'Las Palmas': '35', 'Santa Cruz de Tenerife': '38', 'Ceuta': '51', 'Melilla': '52',
  'Huesca': '22', 'Teruel': '44', 'Zaragoza': '50', 'Albacete': '02', 'Ciudad Real': '13'
};

function obtenerCodigoProvincia(codigoPostal) {
  if (!codigoPostal) return null;
  const prefijo = codigoPostal.substring(0, 2);
  return CP_TO_PROVINCIA[prefijo] || prefijo;
}

function generarNombreArchivo() {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  const hours = String(ahora.getHours()).padStart(2, '0');
  const minutes = String(ahora.getMinutes()).padStart(2, '0');
  const seconds = String(ahora.getSeconds()).padStart(2, '0');
  
  return `alertas-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.csv`;
}

function obtenerArchivoMasReciente() {
  try {
    const archivos = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('alertas-') && f.endsWith('.csv'))
      .sort()
      .reverse();
    
    return archivos.length > 0 ? archivos[0] : null;
  } catch (error) {
    return null;
  }
}

function leerAlertasDesdeArchivo(nombreArchivo) {
  try {
    const rutaArchivo = path.join(DATA_DIR, nombreArchivo);
    
    if (!fs.existsSync(rutaArchivo)) {
      return {};
    }
    
    const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
    const lineas = contenido.split('\n').filter(l => l.trim());
    
    if (lineas.length < 2) {
      return {};
    }
    
    const alertas = {};
    
    for (let i = 1; i < lineas.length; i++) {
      const campos = lineas[i].split(',');
      if (campos.length >= 5) {
        const codigoProv = campos[0].trim();
        alertas[codigoProv] = {
          nombre: campos[1].trim(),
          nivel: campos[2].trim(),
          fenomeno: campos[3].trim() === 'null' ? null : campos[3].trim(),
          timestamp: campos[4].trim()
        };
      }
    }
    
    console.log(`✅ Leídas ${Object.keys(alertas).length} alertas desde ${nombreArchivo}`);
    return alertas;
  } catch (error) {
    console.error('Error leyendo archivo:', error);
    return {};
  }
}

function guardarAlertasEnArchivo(alertasPorProvincia) {
  try {
    const nombreArchivo = generarNombreArchivo();
    const rutaArchivo = path.join(DATA_DIR, nombreArchivo);
    
    let csv = 'codigo_provincia,nombre_provincia,nivel,fenomeno,timestamp\n';
    
    const codigosOrdenados = Object.keys(alertasPorProvincia).sort();
    
    for (const codigo of codigosOrdenados) {
      const datos = alertasPorProvincia[codigo];
      const nombreProv = PROVINCIAS_AEMET[codigo] || `Provincia ${codigo}`;
      const fenomenoEscapado = (datos.fenomeno || 'null').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 200);
      
      csv += `${codigo},${nombreProv},${datos.nivel},${fenomenoEscapado},${datos.timestamp}\n`;
    }
    
    fs.writeFileSync(rutaArchivo, csv, 'utf-8');
    console.log(`💾 ${nombreArchivo}`);
    
    estadoSincronizacion.archivoActual = nombreArchivo;
    eliminarArchivosAntiguos(nombreArchivo);
    
    return nombreArchivo;
  } catch (error) {
    console.error('Error guardando:', error);
    throw error;
  }
}

function eliminarArchivosAntiguos(archivoActual) {
  try {
    const archivos = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('alertas-') && f.endsWith('.csv') && f !== archivoActual);
    
    archivos.forEach(archivo => {
      fs.unlinkSync(path.join(DATA_DIR, archivo));
    });
  } catch (error) {
    // Silenciar error
  }
}

function actualizarEstadoSincronizacion(exito, mensaje = '') {
  estadoSincronizacion.ultimaSincronizacion = new Date().toISOString();
  estadoSincronizacion.totalConsultas++;
  
  if (exito) {
    estadoSincronizacion.consultasExitosas++;
    estadoSincronizacion.estado = 'ok';
    estadoSincronizacion.mensaje = mensaje;
  } else {
    estadoSincronizacion.consultasFallidas++;
    estadoSincronizacion.estado = 'error';
    estadoSincronizacion.mensaje = mensaje;
  }
}

function getEstadoSincronizacion() {
  return {
    ...estadoSincronizacion,
    tasaExito: estadoSincronizacion.totalConsultas > 0 
      ? ((estadoSincronizacion.consultasExitosas / estadoSincronizacion.totalConsultas) * 100).toFixed(1)
      : 0
  };
}

function extraerCodigoProvinciaDeZona(zonaDesc) {
  // Buscar en el mapa de provincias
  for (const [nombreProv, codigo] of Object.entries(MAPA_PROVINCIAS_ALERTAS)) {
    if (zonaDesc.includes(nombreProv)) {
      return codigo;
    }
  }
  
  // Intentar con coincidencia parcial
  const zonaNorm = zonaDesc.toLowerCase();
  for (const [nombreProv, codigo] of Object.entries(MAPA_PROVINCIAS_ALERTAS)) {
    if (zonaNorm.includes(nombreProv.toLowerCase())) {
      return codigo;
    }
  }
  
  return null;
}

function mapearNivelAlerta(nivelTexto) {
  const texto = nivelTexto.toLowerCase();
  
  if (texto.includes('extraordinario') || texto.includes('extremo')) {
    return 'rojo';
  } else if (texto.includes('importante')) {
    return 'naranja';
  } else if (texto.includes('bajo') || texto.includes('peligro')) {
    return 'amarillo';
  }
  
  return 'verde';
}

async function descargarAlertasAEMET() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 ANALIZANDO ALERTAS AEMET (Procesado Detallado)');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const alertasPorProvincia = {};
  const todosLosCodigos = Object.keys(PROVINCIAS_AEMET);
  
  // Inicializar todo en verde
  todosLosCodigos.forEach(codigo => {
    alertasPorProvincia[codigo] = { nivel: 'verde', fenomeno: null, timestamp: new Date().toISOString() };
  });
  
  try {
    const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado/area/esp?api_key=${AEMET_API_KEY}`;
    const response = await fetch(url, { timeout: 15000 });
    const data = await response.json();
    
    const datosResponse = await fetch(data.datos, { timeout: 15000 });
    const xmlData = await datosResponse.text();

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const result = parser.parse(xmlData);

    let entries = [];
    if (result.feed && result.feed.entry) {
      entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
    }

    console.log(`📥 Analizando ${entries.length} entradas del feed...`);
    
    entries.forEach(entry => {
      const titulo = (entry.title || "").toString();
      const resumen = (entry.summary || "").toString();
      const textoCompleto = `${titulo} ${resumen}`; // Buscamos en ambos campos

      // 1. Determinar el nivel de riesgo
      let nivel = 'verde';
      const tLower = textoCompleto.toLowerCase();
      
      if (tLower.includes('rojo') || tLower.includes('extremo')) nivel = 'rojo';
      else if (tLower.includes('naranja') || tLower.includes('importante')) nivel = 'naranja';
      else if (tLower.includes('amarillo') || tLower.includes('riesgo')) nivel = 'amarillo';

      if (nivel === 'verde') return;

      // 2. Identificar la provincia (Normalización básica para evitar fallos por tildes/mayúsculas)
      let codigoProv = null;
      const textoNormalizado = textoCompleto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      for (const [nombreProv, codigo] of Object.entries(MAPA_PROVINCIAS_ALERTAS)) {
        const nombreNormalizado = nombreProv.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        if (textoNormalizado.includes(nombreNormalizado)) {
          codigoProv = codigo;
          break;
        }
      }

      // 3. Extraer fenómeno
      const matchFenomeno = titulo.match(/por\s(.*?)\sen/i) || resumen.match(/por\s(.*?)\sen/i);
      const fenomeno = matchFenomeno ? matchFenomeno[1].trim() : 'Fenómeno adverso';

      if (codigoProv) {
        const prioridad = { rojo: 4, naranja: 3, amarillo: 2, verde: 1 };
        const nivelActual = alertasPorProvincia[codigoProv].nivel;
        
        if (prioridad[nivel] > prioridad[nivelActual]) {
          alertasPorProvincia[codigoProv] = {
            nivel,
            fenomeno: fenomeno.charAt(0).toUpperCase() + fenomeno.slice(1),
            timestamp: new Date().toISOString()
          };
        }
      }
    });
    
    // Feedback por consola
    let conAlertas = 0;
    todosLosCodigos.forEach(codigo => {
      if (alertasPorProvincia[codigo].nivel !== 'verde') {
        const datos = alertasPorProvincia[codigo];
        const emoji = datos.nivel === 'rojo' ? '🔴' : datos.nivel === 'naranja' ? '🟠' : '🟡';
        console.log(`${emoji} [${codigo}] ${PROVINCIAS_AEMET[codigo]}: ${datos.nivel.toUpperCase()} - ${datos.fenomeno}`);
        conAlertas++;
      }
    });
    
    if (conAlertas === 0) console.log("⚠️ No se han detectado alertas activas en el procesado.");

    guardarAlertasEnArchivo(alertasPorProvincia);
    actualizarEstadoSincronizacion(true, `Sincronizado: ${conAlertas} alertas.`);
    return alertasPorProvincia;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    actualizarEstadoSincronizacion(false, `Error: ${error.message}`);
    throw error;
  }
}
async function obtenerAlertasAEMET(provincia, codigoPostal) {
  try {
    const codigoProv = provincia || obtenerCodigoProvincia(codigoPostal);
    
    if (!codigoProv) {
      return {
        ...NIVELES_ALERTA.verde,
        fenomeno: null,
        actualizacion: new Date().toISOString()
      };
    }
    
    const cacheKey = `alertas_${codigoProv}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    const archivoReciente = obtenerArchivoMasReciente();
    
    if (archivoReciente) {
      const alertasArchivo = leerAlertasDesdeArchivo(archivoReciente);
      
      if (alertasArchivo[codigoProv]) {
        const datosAlerta = alertasArchivo[codigoProv];
        const resultado = {
          ...NIVELES_ALERTA[datosAlerta.nivel],
          fenomeno: datosAlerta.fenomeno,
          actualizacion: datosAlerta.timestamp
        };
        
        cache.set(cacheKey, { data: resultado, timestamp: Date.now() });
        return resultado;
      }
    }
    
    return {
      ...NIVELES_ALERTA.verde,
      fenomeno: null,
      actualizacion: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      ...NIVELES_ALERTA.verde,
      fenomeno: null,
      actualizacion: new Date().toISOString()
    };
  }
}

async function forzarActualizacion() {
  console.log('\n🔄 ACTUALIZACIÓN FORZADA');
  cache.clear();
  await descargarAlertasAEMET();
  console.log('✅ Completada\n');
}

async function inicializar() {
  console.log('\n🚀 Inicializando...');
  
  const archivoReciente = obtenerArchivoMasReciente();
  
  if (archivoReciente) {
    console.log(`📂 ${archivoReciente}`);
    estadoSincronizacion.archivoActual = archivoReciente;
    estadoSincronizacion.estado = 'ok';
    estadoSincronizacion.mensaje = `Usando ${archivoReciente}`;
    
    const match = archivoReciente.match(/alertas-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.csv/);
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      estadoSincronizacion.ultimaSincronizacion = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    }
    
    const alertas = leerAlertasDesdeArchivo(archivoReciente);
    console.log(`✅ ${Object.keys(alertas).length} provincias\n`);
  } else {
    console.log('📥 Descargando...\n');
    try {
      await descargarAlertasAEMET();
    } catch (error) {
      console.error('❌ Error inicial:', error.message);
      console.log('⚠️  Continuando sin datos\n');
    }
  }
}

if (require.main !== module) {
  inicializar().catch(err => {
    console.error('Error:', err);
  });
}

module.exports = {
  obtenerAlertasAEMET,
  getEstadoSincronizacion,
  forzarActualizacion
};
