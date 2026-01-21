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
    
    let csv = 'codigo_provincia,nombre_provincia,nivel,fenomeno,timestamp\n';
    
    const codigosOrdenados = Object.keys(alertasPorProvincia).sort();
    
    for (const codigo of codigosOrdenados) {
      const datos = alertasPorProvincia[codigo];
      const nombreProv = PROVINCIAS_AEMET[codigo] || `Provincia ${codigo}`;
      const fenomenoEscapado = (datos.fenomeno || 'null').replace(/,/g, ';').replace(/\n/g, ' ');
      
      csv += `${codigo},${nombreProv},${datos.nivel},${fenomenoEscapado},${datos.timestamp}\n`;
    }
    
    fs.writeFileSync(rutaArchivo, csv, 'utf-8');
    console.log(`💾 Alertas guardadas en ${nombreArchivo}`);
    console.log(`   📊 Total provincias/territorios: ${codigosOrdenados.length}`);
    
    estadoSincronizacion.archivoActual = nombreArchivo;
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
 * Descargar alertas consultando provincia por provincia
 */
async function descargarAlertasAEMET() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 DESCARGANDO ALERTAS AEMET (Todas las provincias)');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Inicializar todas las provincias en verde
    const alertasPorProvincia = {};
    const todosLosCodigos = Object.keys(PROVINCIAS_AEMET);
    
    todosLosCodigos.forEach(codigo => {
      alertasPorProvincia[codigo] = {
        nivel: 'verde',
        fenomeno: null,
        timestamp: new Date().toISOString()
      };
    });
    
    let consultasExitosas = 0;
    let provinciasCon Alertas = 0;
    
    console.log(`📋 Consultando ${todosLosCodigos.length} provincias/territorios...\n`);
    
    // Consultar cada provincia
    for (const codigoProv of todosLosCodigos) {
      const nombreProv = PROVINCIAS_AEMET[codigoProv];
      
      try {
        // Endpoint correcto: /avisos_cap/ultimoelaborado/area/{provincia}
        const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado/area/${codigoProv}?api_key=${AEMET_API_KEY}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          timeout: 10000
        });
        
        if (!response.ok) {
          console.log(`   ⚠️  [${codigoProv}] ${nombreProv}: HTTP ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // La API devuelve estado 200 y datos
        if (data.estado === 200 && data.datos) {
          // Obtener datos reales
          const datosResponse = await fetch(data.datos, { timeout: 10000 });
          
          if (!datosResponse.ok) {
            console.log(`   ⚠️  [${codigoProv}] ${nombreProv}: Error obteniendo datos`);
            continue;
          }
          
          const alertas = await datosResponse.json();
          
          if (Array.isArray(alertas) && alertas.length > 0) {
            // Procesar alertas
            let nivelMaximo = 'verde';
            let fenomenoActivo = null;
            
            const prioridad = { rojo: 4, naranja: 3, amarillo: 2, verde: 1 };
            
            alertas.forEach(alerta => {
              if (alerta.nivel) {
                const nivel = alerta.nivel.toLowerCase();
                if (prioridad[nivel] > prioridad[nivelMaximo]) {
                  nivelMaximo = nivel;
                  fenomenoActivo = alerta.fenomeno || alerta.evento || 'Sin especificar';
                }
              }
            });
            
            if (nivelMaximo !== 'verde') {
              alertasPorProvincia[codigoProv] = {
                nivel: nivelMaximo,
                fenomeno: fenomenoActivo,
                timestamp: new Date().toISOString()
              };
              
              const emoji = nivelMaximo === 'rojo' ? '🔴' : nivelMaximo === 'naranja' ? '🟠' : '🟡';
              console.log(`   ${emoji} [${codigoProv}] ${nombreProv}: ${nivelMaximo.toUpperCase()} - ${fenomenoActivo}`);
              provinciasConAlertas++;
            } else {
              console.log(`   🟢 [${codigoProv}] ${nombreProv}: Sin alertas`);
            }
            
            consultasExitosas++;
          } else {
            console.log(`   🟢 [${codigoProv}] ${nombreProv}: Sin alertas`);
            consultasExitosas++;
          }
        } else {
          console.log(`   ⚠️  [${codigoProv}] ${nombreProv}: Respuesta inesperada`);
        }
        
        // Pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ [${codigoProv}] ${nombreProv}: ${error.message}`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`📊 RESUMEN:`);
    console.log(`   📦 Total provincias: ${todosLosCodigos.length}`);
    console.log(`   ✅ Consultas exitosas: ${consultasExitosas}`);
    console.log(`   ⚠️  Con alertas activas: ${provinciasConAlertas}`);
    console.log(`   🟢 Sin alertas: ${consultasExitosas - provinciasConAlertas}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Guardar en CSV
    const nombreArchivo = guardarAlertasEnArchivo(alertasPorProvincia);
    
    actualizarEstadoSincronizacion(
      consultasExitosas > 0, 
      `Descarga completada: ${nombreArchivo} (${provinciasConAlertas} alertas activas)`
    );
    
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
