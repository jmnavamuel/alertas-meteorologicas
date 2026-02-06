# Datos de Alertas - Alertas Meteorológicas AEMET

Esta carpeta contiene los datos de alertas procesados del sistema AEMET.

## Archivos

- **alertas-YYYYMMDD-HHMM.csv** - Datos reales de alertas descargadas de AEMET (se generan automáticamente cada hora)
- **alertas_dummy.csv** - Datos de prueba con múltiples tipos de alertas para testing y demostración

## Datos Dummy

El archivo `alertas_dummy.csv` contiene alertas de prueba para todas las sedes con diversos tipos de fenómenos:

### Fenómenos incluidos
- 🌪️ Tormenta
- ❄️ Nieve
- 💨 Viento
- 🌧️ Lluvia
- 🧊 Granizo
- 🌫️ Niebla
- 🔥 Calor

### Niveles incluidos
- 🔴 Rojo (Riesgo extremo)
- 🟠 Naranja (Riesgo importante)
- 🟡 Amarillo (Advertencia)

### Cómo usar datos dummy

**Opción 1: Usando archivo config.ini (RECOMENDADO):**

Edita `config.ini` en la raíz del proyecto:
```ini
[data]
mode=dummy    # Cambiar a 'real' para datos de AEMET
```

O usa el script de ayuda:
```bash
cd /path/to/alertas-meteorologicas
./switch-data-mode.sh dummy   # Cambiar a dummy
./switch-data-mode.sh real    # Cambiar a real
./switch-data-mode.sh status  # Ver modo actual
```

**Opción 2: Script Python (heredado):**
```bash
# Cambiar a datos dummy para testing
python3 USE_DUMMY_DATA.py dummy

# Volver a datos reales
python3 USE_DUMMY_DATA.py real
```

> **Nota**: El archivo `config.ini` es la forma preferida y más operativa. El script `USE_DUMMY_DATA.py` se mantiene por compatibilidad.

## Formato de los archivos CSV

```
codigo_provincia,nombre_provincia,subprovincia,nivel,fenomeno,start,end,timestamp,source_file,excerpt
```

### Campos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `codigo_provincia` | Código numérico de la provincia (AEMET) | `28` |
| `nombre_provincia` | Nombre de la provincia | `Madrid` |
| `subprovincia` | Área específica dentro de la provincia | `Zona metropolitana` |
| `nivel` | Nivel de alerta | `rojo`, `naranja`, `amarillo`, `verde` |
| `fenomeno` | Tipo de fenómeno meteorológico | `Tormenta`, `Nieve`, `Viento`, etc. |
| `start` | Fecha y hora de inicio de la alerta (ISO 8601) | `2026-02-06T08:00:00Z` |
| `end` | Fecha y hora de fin de la alerta (ISO 8601) | `2026-02-06T14:00:00Z` |
| `timestamp` | Fecha y hora de procesamiento | `2026-02-06T09:15:30Z` |
| `source_file` | Archivo XML fuente de AEMET | `Z_CAP_C_LEMM_...xml` |
| `excerpt` | Descripción del alerta | `Alerta roja por tormentas severas` |

## .gitignore

Los archivos CSV de alertas generados automáticamente están en `.gitignore` y no se suben a GitHub. Solo el `alertas_dummy.csv` se versionan para testing.

