const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const AEMET_API_KEY = process.env.AEMET_API_KEY;
const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';
const DATA_DIR = path.join(__dirname, '../data');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

// Cache de alertas en memoria
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

// Estado de sincronización
let estadoSincronizacion = {
  ultimaSincronizacion: null,
  estado: 'pendiente',
  mensaje: 'Esperando primera sincronización',
  totalConsultas: 0,
  consultasExitosas: 0,
  consultasFallidas: 0,
  archivoActual: null
};

// Mapeo completo de códigos AEMET a nombres de provincias/territorios
const PROVINCIAS_AEMET = {
  '01': 'Araba/Álava',
  '02': 'Albacete',
  '03': 'Alicante/Alacant',
  '04': 'Almería',
  '05': 'Ávila',
  '06': 'Badajoz',
  '07': 'Illes Balears',
  '08': 'Barcelona',
  '09': 'Burgos',
  '10': 'Cáceres',
  '11': 'Cádiz',
  '12': 'Castellón/Castelló',
  '13': 'Ciudad Real',
  '14': 'Córdoba',
  '15': 'A Coruña',
  '16': 'Cuenca',
  '17': 'Girona',
  '18': 'Granada',
  '19': 'Guadalajara',
  '20': 'Gipuzkoa',
  '21': 'Huelva',
  '22': 'Huesca',
  '23': 'Jaén',
  '24': 'León',
  '25': 'Lleida',
  '26': 'La Rioja',
  '27': 'Lugo',
  '28': 'Madrid',
  '29': 'Málaga',
  '30': 'Murcia',
  '31': 'Navarra',
  '32': 'Ourense',
  '33': 'Asturias',
  '34': 'Palencia',
  '35': 'Las Palmas',
  '36': 'Pontevedra',
  '37': 'Salamanca',
  '38': 'Santa Cruz de Tenerife',
  '39': 'Cantabria',
  '40': 'Segovia',
  '41': 'Sevilla',
  '42': 'Soria',
  '43': 'Tarragona',
  '44': 'Teruel',
  '45': 'Toledo',
  '46': 'Valencia/València',
  '47': 'Valladolid',
  '48': 'Bizkaia',
  '49': 'Zamora',
  '50': 'Zaragoza',
  '51': 'Ceuta',
  '52': 'Melilla'
};

// Mapeo de códigos postales a códigos de provincia AEMET
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

// Niveles de alerta AEMET
const NIVELES_ALERTA = {
  verde: { color: '#28a745', nivel: 'verde', nombre: 'Sin riesgo' },
  amarillo: { color: '#ffc107', nivel: 'amarillo', nombre: 'Riesgo' },
  naranja: { color: '#fd7e14', nivel: 'naranja', nombre: 'Riesgo importante' },
  rojo: { color: '#dc3545', nivel: 'rojo', nombre: 'Riesgo extremo' }
};

/**
 * Crear directorio temporal si no existe
 */
function asegurarDirectorioTemporal() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`📁 Directorio temporal creado: ${TEMP_DIR}`);
  }
}

/**
 * Limpiar directorio temporal
 */
function limpiarDirectorioTemporal() {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      const archivos = fs.readdirSync(TEMP_DIR);
      archivos.forEach(archivo => {
        fs.unlinkSync(path.join(TEMP_DIR, archivo));
      });
      console.log('🧹 Directorio temporal limpiado');
    }
  } catch (error) {
    console.error('Error limpiando directorio temporal:', error);
  }
}

/**
 * Obtiene el código de provincia desde el código postal
 */
function obtenerCodigoProvincia(codigoPostal) {
  if (!codigoPostal) return null;
  const prefijo = codigoPostal.substring(0, 2);
  return CP_TO_PROVINCIA[prefijo] || prefijo;
}

/**
 * Genera nombre de archivo con timestamp
 */
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

/**
 * Obtener archivo de alertas más reciente
 */
function obtenerArchivoMasReciente() {
  try {
    const archivos = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('alertas-') && f.endsWith('.csv'))
      .sort()
      .reverse();
    
    return archivos.length > 0 ? archivos[0] : null;
  } catch (error) {
    console.error('Error buscando archivos de alertas:', error);
    return null;
  }
}

/**
 * Leer alertas desde archivo CSV
 */
function leerAlertasDesdeArchivo(nombreArchivo) {
  try {
    const rutaArchivo = path.join(DATA_DIR, nombreArchivo);
    
    if (!fs.existsSync(rutaArchivo)) {
      console.log(`⚠️  Archivo ${nombreArchivo} no encontrado`);
      return {};
    }
    
    const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
    const lineas = contenido.split('\n').filter(l => l.trim());
    
    if (lineas.length < 2) {
      console.log('⚠️  Archivo de alertas vacío o sin datos');
      return {};
    }
    
    const alertas = {};
    
    // Saltar cabecera
    for (let i = 1; i < lineas.length; i++) {
      const campos = lineas[i].split(',');
      if (campos.length >= 5) {
        const codigoProv = campos[0].trim();
        const nombreProv = campos[1].trim();
        const nivel = campos[2].trim();
        const fenomeno = campos[3].trim();
        const timestamp = campos[4].trim();
        
        alertas[codigoProv] = {
          nombre: nombreProv,
          nivel,
          fenomeno: fenomeno === 'null' ? null : fenomeno,
          timestamp
        };
      }
    }
    
    console.log(`✅ Leídas ${Object.keys(alertas).length} alertas desde ${nombreArchivo}`);
    return alertas;
  } catch (error) {
    console.error('Error leyendo archivo de alertas:', error);
    return {};
  }
}

/**
 * Guardar alertas en archivo CSV
 */
function guardarAlertasEnArchivo(alertasPorProvincia) {
  try {
    const nombreArchivo = generarNombreArchivo();
    const rutaArchivo = path.join(DATA_DIR, nombreArchivo);
    
    // Crear contenido CSV con cabecera
    let csv = 'codigo_provincia,nombre_provincia,nivel,fenomeno,timestamp\n';
    
    // Ordenar por código de provincia para mantener orden consistente
    const codigosOrdenados = Object.keys(alertasPorProvincia).sort();
    
    for (const codigo of codigosOrdenados) {
      const datos = alertasPorProvincia[codigo];
      const nombreProv = PROVINCIAS_AEMET[codigo] || `Provincia ${codigo}`;
      const fenomenoEscapado = (datos.fenomeno || 'null').replace(/,/g, ';').replace(/\n/g, ' ');
      
      csv += `${codigo},${nombreProv},${datos.nivel},${fenomenoEscapado},${datos.timestamp}\n`;
    }
    
    // Guardar archivo
    fs.writeFileSync(rutaArchivo, csv, 'utf-8');
    console.log(`💾 Alertas guardadas en ${nombreArchivo}`);
    console.log(`   📊 Total provincias/territorios: ${codigosOrdenados.length}`);
    
    // Actualizar estado
    estadoSincronizacion.archivoActual = nombreArchivo;
    
    // Eliminar archivos antiguos (mantener solo el más reciente)
    eliminarArchivosAntiguos(nombreArchivo);
    
    return nombreArchivo;
  } catch (error) {
    console.error('Error guardando archivo de alertas:', error);
    throw error;
  }
}

/**
 * Eliminar archivos antiguos de alertas
 */
function eliminarArchivosAntiguos(archivoActual) {
  try {
    const archivos = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('alertas-') && f.endsWith('.csv') && f !== archivoActual);
    
    archivos.forEach(archivo => {
      const ruta = path.join(DATA_DIR, archivo);
      fs.unlinkSync(ruta);
      console.log(`🗑️  Eliminado archivo antiguo: ${archivo}`);
    });
  } catch (error) {
    console.error('Error eliminando archivos antiguos:', error);
  }
}

/**
 * Actualizar estado de sincronización
 */
function actualizarEstadoSincronizacion(exito, mensaje = '') {
  estadoSincronizacion.ultimaSincronizacion = new Date().toISOString();
  estadoSincronizacion.totalConsultas++;
  
  if (exito) {
    estadoSincronizacion.consultasExitosas++;
    estadoSincronizacion.estado = 'ok';
    estadoSincronizacion.mensaje = mensaje || 'Sincronización exitosa';
  } else {
    estadoSincronizacion.consultasFallidas++;
    estadoSincronizacion.estado = 'error';
    estadoSincronizacion.mensaje = mensaje || 'Error en la sincronización';
  }
}

/**
 * Obtener estado de sincronización
 */
function getEstadoSincronizacion() {
  return {
    ...estadoSincronizacion,
    tasaExito: estadoSincronizacion.totalConsultas > 0 
      ? ((estadoSincronizacion.consultasExitosas / estadoSincronizacion.totalConsultas) * 100).toFixed(1)
      : 0
  };
}

/**
 * Extraer código de provincia desde nombre de archivo CAP
 */
function extraerCodigoProvinciaDeArchivo(nombreArchivo) {
  // Los archivos CAP suelen tener formato: ES-A-ES_28_20260120123045_...
  // O similar con código de provincia
  const match = nombreArchivo.match(/ES[_-][A-Z][_-]ES[_-](\d{2})[_-]/i);
  if (match && match[1]) {
    return match[1];
  }
  
  // Intentar otros patrones
  const match2 = nombreArchivo.match(/[_-](\d{2})[_-]/);
  if (match2 && match2[1] && PROVINCIAS_AEMET[match2[1]]) {
    return match2[1];
  }
  
  return null;
}

/**
 * Procesar archivo CAP XML
 */
function procesarArchivoCAP(rutaArchivo) {
  try {
    const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
    
    // Buscar nivel de alerta (severity)
    const severityMatch = contenido.match(/<severity>(.*?)<\/severity>/i);
    const eventMatch = contenido.match(/<event>(.*?)<\/event>/i);
    const areaDescMatch = contenido.match(/<areaDesc>(.*?)<\/areaDesc>/i);
    
    if (!severityMatch) {
      return null;
    }
    
    const severity = severityMatch[1].toLowerCase();
    const evento = eventMatch ? eventMatch[1] : null;
    const areaDesc = areaDescMatch ? areaDescMatch[1] : null;
    
    // Mapear severity de CAP a niveles AEMET
    let nivel = 'verde';
    if (severity.includes('extreme')) nivel = 'rojo';
    else if (severity.includes('severe')) nivel = 'naranja';
    else if (severity.includes('moderate')) nivel = 'amarillo';
    else if (severity.includes('minor')) nivel = 'amarillo';
    
    return {
      nivel,
      fenomeno: evento || areaDesc,
      areaDesc
    };
    
  } catch (error) {
    console.error(`Error procesando archivo CAP ${path.basename(rutaArchivo)}:`, error.message);
    return null;
  }
}

/**
 * Descargar y procesar alertas desde AEMET
 */
async function descargarAlertasAEMET() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 DESCARGANDO ALERTAS AEMET (Archivo completo)');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    asegurarDirectorioTemporal();
    limpiarDirectorioTemporal();
    
    // 1. Obtener URL del archivo de alertas desde la API
    console.log('📡 Consultando API de AEMET...');
    const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado?api_key=${AEMET_API_KEY}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.datos) {
      throw new Error('La API no devolvió URL de datos');
    }
    
    console.log(`✅ URL de descarga obtenida`);
    
    // 2. Descargar archivo tar.gz
    console.log('📥 Descargando archivo de alertas...');
    const archivoResponse = await fetch(data.datos, { timeout: 30000 });
    
    if (!archivoResponse.ok) {
      throw new Error(`Error descargando archivo: ${archivoResponse.status}`);
    }
    
    const buffer = await archivoResponse.buffer();
    const rutaTarGz = path.join(TEMP_DIR, 'alertas.tar.gz');
    fs.writeFileSync(rutaTarGz, buffer);
    
    console.log(`✅ Archivo descargado: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    // 3. Extraer archivo tar.gz
    console.log('📦 Extrayendo archivos...');
    await execAsync(`tar -xzf "${rutaTarGz}" -C "${TEMP_DIR}"`);
    console.log('✅ Archivos extraídos');
    
    // 4. Procesar archivos CAP XML
    console.log('📊 Procesando archivos de alertas...\n');
    
    const archivosXML = fs.readdirSync(TEMP_DIR)
      .filter(f => f.endsWith('.xml') || f.endsWith('.cap'));
    
    console.log(`   Encontrados ${archivosXML.length} archivos CAP\n`);
    
    // Inicializar todas las provincias en verde
    const alertasPorProvincia = {};
    Object.keys(PROVINCIAS_AEMET).forEach(codigo => {
      alertasPorProvincia[codigo] = {
        nivel: 'verde',
        fenomeno: null,
        timestamp: new Date().toISOString()
      };
    });
    
    let procesados = 0;
    let conAlertas = 0;
    
    // Procesar cada archivo CAP
    for (const archivo of archivosXML) {
      const rutaCompleta = path.join(TEMP_DIR, archivo);
      const codigoProv = extraerCodigoProvinciaDeArchivo(archivo);
      
      if (!codigoProv || !PROVINCIAS_AEMET[codigoProv]) {
        console.log(`   ⚠️  ${archivo}: No se pudo identificar provincia`);
        continue;
      }
      
      const datosAlerta = procesarArchivoCAP(rutaCompleta);
      
      if (!datosAlerta) {
        continue;
      }
      
      const nombreProv = PROVINCIAS_AEMET[codigoProv];
      
      // Actualizar solo si el nivel es mayor que el actual
      const prioridad = { rojo: 4, naranja: 3, amarillo: 2, verde: 1 };
      const nivelActual = alertasPorProvincia[codigoProv].nivel;
      
      if (prioridad[datosAlerta.nivel] > prioridad[nivelActual]) {
        alertasPorProvincia[codigoProv] = {
          nivel: datosAlerta.nivel,
          fenomeno: datosAlerta.fenomeno,
          timestamp: new Date().toISOString()
        };
        
        const emoji = datosAlerta.nivel === 'rojo' ? '🔴' : 
                      datosAlerta.nivel === 'naranja' ? '🟠' : '🟡';
        console.log(`   ${emoji} [${codigoProv}] ${nombreProv}: ${datosAlerta.nivel.toUpperCase()} - ${datosAlerta.fenomeno}`);
        conAlertas++;
      }
      
      procesados++;
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`📊 RESUMEN:`);
    console.log(`   📦 Archivos CAP procesados: ${procesados}`);
    console.log(`   ⚠️  Provincias con alertas: ${conAlertas}`);
    console.log(`   🟢 Provincias en verde: ${52 - conAlertas}`);
    console.log(`   📋 Total provincias: 52`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 5. Guardar en CSV
    const nombreArchivo = guardarAlertasEnArchivo(alertasPorProvincia);
    
    // 6. Limpiar archivos temporales
    limpiarDirectorioTemporal();
    
    actualizarEstadoSincronizacion(true, `Descarga completada: ${nombreArchivo} (${conAlertas} alertas activas)`);
    
    return alertasPorProvincia;
    
  } catch (error) {
    console.error('❌ Error en descarga de alertas:', error.message);
    actualizarEstadoSincronizacion(false, `Error: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene las alertas meteorológicas de AEMET para una provincia
 */
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
    
    // Verificar cache en memoria
    const cacheKey = `alertas_${codigoProv}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    // Leer desde archivo más reciente
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
    console.error('Error obteniendo alertas AEMET:', error);
    return {
      ...NIVELES_ALERTA.verde,
      fenomeno: null,
      actualizacion: new Date().toISOString()
    };
  }
}

/**
 * Forzar actualización
 */
async function forzarActualizacion() {
  console.log('\n🔄 ACTUALIZACIÓN FORZADA INICIADA');
  cache.clear();
  console.log('🧹 Cache limpiado');
  await descargarAlertasAEMET();
  console.log('✅ Actualización forzada completada\n');
}

/**
 * Inicialización
 */
async function inicializar() {
  console.log('\n🚀 Inicializando servicio de alertas AEMET...');
  
  const archivoReciente = obtenerArchivoMasReciente();
  
  if (archivoReciente) {
    console.log(`📂 Archivo existente: ${archivoReciente}`);
    estadoSincronizacion.archivoActual = archivoReciente;
    estadoSincronizacion.estado = 'ok';
    estadoSincronizacion.mensaje = `Usando datos de ${archivoReciente}`;
    
    const match = archivoReciente.match(/alertas-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.csv/);
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      estadoSincronizacion.ultimaSincronizacion = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    }
    
    const alertas = leerAlertasDesdeArchivo(archivoReciente);
    console.log(`✅ ${Object.keys(alertas).length} provincias cargadas\n`);
  } else {
    console.log('📥 Descargando datos iniciales...\n');
    await descargarAlertasAEMET();
  }
}

inicializar();

module.exports = {
  obtenerAlertasAEMET,
  getEstadoSincronizacion,
  forzarActualizacion
};
