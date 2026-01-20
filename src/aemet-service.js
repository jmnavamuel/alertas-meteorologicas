const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const AEMET_API_KEY = process.env.AEMET_API_KEY;
const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';
const DATA_DIR = path.join(__dirname, '../data');

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

// Mapeo de códigos postales a provincias AEMET
const CP_TO_PROVINCIA = {
  '28': '28', // Madrid
  '08': '08', // Barcelona
  '46': '46', // Valencia
  '41': '41', // Sevilla
  '48': '48', // Bizkaia
  '50': '50', // Zaragoza
  '29': '29', // Málaga
  '03': '03', // Alicante
  '39': '39', // Cantabria
  '45': '45', // Toledo
  '38': '38', // Santa Cruz de Tenerife
  '35': '35'  // Las Palmas
};

// Niveles de alerta AEMET
const NIVELES_ALERTA = {
  verde: { color: '#28a745', nivel: 'verde', nombre: 'Sin riesgo' },
  amarillo: { color: '#ffc107', nivel: 'amarillo', nombre: 'Riesgo' },
  naranja: { color: '#fd7e14', nivel: 'naranja', nombre: 'Riesgo importante' },
  rojo: { color: '#dc3545', nivel: 'rojo', nombre: 'Riesgo extremo' }
};

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
  const fecha = ahora.toISOString().replace(/[:.]/g, '-').split('T')[0];
  const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `alertas-${fecha}-${hora}.csv`;
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
      if (campos.length >= 4) {
        const provincia = campos[0].trim();
        const nivel = campos[1].trim();
        const fenomeno = campos[2].trim();
        const timestamp = campos[3].trim();
        
        alertas[provincia] = {
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
    
    // Crear contenido CSV
    let csv = 'provincia,nivel,fenomeno,timestamp\n';
    
    for (const [provincia, datos] of Object.entries(alertasPorProvincia)) {
      const fenomenoEscapado = (datos.fenomeno || 'null').replace(/,/g, ';');
      csv += `${provincia},${datos.nivel},${fenomenoEscapado},${datos.timestamp}\n`;
    }
    
    // Guardar archivo
    fs.writeFileSync(rutaArchivo, csv, 'utf-8');
    console.log(`💾 Alertas guardadas en ${nombreArchivo}`);
    
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
 * Realiza una petición a la API de AEMET
 */
async function peticionAEMET(url) {
  try {
    console.log(`🔍 Consultando: ${url.substring(0, 100)}...`);
    
    const response = await fetch(`${url}?api_key=${AEMET_API_KEY}`, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status} - ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Verificar si la API devuelve un error
    if (data.estado && data.estado !== 200) {
      console.error(`❌ Error AEMET API: ${data.estado} - ${data.descripcion}`);
      return null;
    }
    
    // La API de AEMET devuelve una URL con los datos reales en el campo 'datos'
    if (data.datos) {
      console.log(`📥 Obteniendo datos desde: ${data.datos.substring(0, 80)}...`);
      
      const datosResponse = await fetch(data.datos, {
        timeout: 10000
      });
      
      if (!datosResponse.ok) {
        console.error(`❌ Error obteniendo datos: ${datosResponse.status}`);
        return null;
      }
      
      const resultado = await datosResponse.json();
      console.log(`✅ Datos obtenidos correctamente (${Array.isArray(resultado) ? resultado.length : 'N/A'} elementos)`);
      return resultado;
    }
    
    console.log('✅ Respuesta obtenida (sin datos secundarios)');
    return data;
    
  } catch (error) {
    console.error(`❌ Error en petición AEMET: ${error.message}`);
    return null;
  }
}

/**
 * Descargar alertas de todas las provincias desde AEMET
 */
async function descargarAlertasAEMET() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 INICIANDO DESCARGA DE ALERTAS AEMET');
  console.log('═══════════════════════════════════════════════════════');
  
  const alertasPorProvincia = {};
  const provincias = Object.values(CP_TO_PROVINCIA);
  let exitosas = 0;
  let fallidas = 0;
  
  for (const provincia of provincias) {
    try {
      console.log(`\n📍 Procesando provincia: ${provincia}`);
      
      const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado/area/${provincia}`;
      const alertas = await peticionAEMET(url);
      
      if (!alertas) {
        console.log(`⚠️  Provincia ${provincia}: No hay datos disponibles (asumiendo verde)`);
        alertasPorProvincia[provincia] = {
          nivel: 'verde',
          fenomeno: null,
          timestamp: new Date().toISOString()
        };
        fallidas++;
      } else if (alertas.length === 0) {
        console.log(`✅ Provincia ${provincia}: Sin alertas activas (verde)`);
        alertasPorProvincia[provincia] = {
          nivel: 'verde',
          fenomeno: null,
          timestamp: new Date().toISOString()
        };
        exitosas++;
      } else {
        // Procesar alertas
        let nivelMaximo = 'verde';
        let fenomenoActivo = null;
        
        console.log(`   📊 Encontradas ${alertas.length} alertas para procesar`);
        
        alertas.forEach((alerta, idx) => {
          console.log(`   Alerta ${idx + 1}:`, {
            nivel: alerta.nivel,
            fenomeno: alerta.fenomeno || alerta.evento || 'N/A'
          });
          
          if (alerta.nivel) {
            const nivel = alerta.nivel.toLowerCase();
            
            if (nivel === 'rojo' || (nivel === 'naranja' && nivelMaximo !== 'rojo') || 
                (nivel === 'amarillo' && nivelMaximo === 'verde')) {
              nivelMaximo = nivel;
              fenomenoActivo = alerta.fenomeno || alerta.evento || null;
            }
          }
        });
        
        alertasPorProvincia[provincia] = {
          nivel: nivelMaximo,
          fenomeno: fenomenoActivo,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ Provincia ${provincia}: Nivel ${nivelMaximo.toUpperCase()} ${fenomenoActivo ? `- ${fenomenoActivo}` : ''}`);
        exitosas++;
      }
      
      // Pausa para no saturar la API (importante)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error crítico en provincia ${provincia}:`, error.message);
      alertasPorProvincia[provincia] = {
        nivel: 'verde',
        fenomeno: null,
        timestamp: new Date().toISOString()
      };
      fallidas++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📊 RESUMEN DE DESCARGA:`);
  console.log(`   ✅ Exitosas: ${exitosas}`);
  console.log(`   ❌ Fallidas: ${fallidas}`);
  console.log(`   📦 Total provincias: ${provincias.length}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Guardar en archivo
  const nombreArchivo = guardarAlertasEnArchivo(alertasPorProvincia);
  
  const mensajeEstado = exitosas > 0 
    ? `Descarga completada: ${nombreArchivo} (${exitosas}/${provincias.length} provincias)`
    : `Error en descarga: ${fallidas} provincias fallidas`;
  
  actualizarEstadoSincronizacion(exitosas > 0, mensajeEstado);
  
  return alertasPorProvincia;
}

/**
 * Obtiene las alertas meteorológicas de AEMET para una provincia
 */
async function obtenerAlertasAEMET(provincia, codigoPostal) {
  try {
    const codigoProv = provincia || obtenerCodigoProvincia(codigoPostal);
    
    if (!codigoProv) {
      console.warn('No se pudo determinar la provincia para CP:', codigoPostal);
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
    
    // Intentar leer desde archivo más reciente
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
        
        // Guardar en cache
        cache.set(cacheKey, { data: resultado, timestamp: Date.now() });
        
        return resultado;
      }
    }
    
    // Si no hay datos en archivo, devolver verde
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
 * Forzar actualización descargando nuevos datos de AEMET
 */
async function forzarActualizacion() {
  console.log('\n🔄 ACTUALIZACIÓN FORZADA INICIADA');
  
  // Limpiar cache
  cache.clear();
  console.log('🧹 Cache limpiado');
  
  // Descargar nuevos datos
  await descargarAlertasAEMET();
  
  console.log('✅ Actualización forzada completada\n');
}

/**
 * Inicialización: cargar archivo más reciente o descargar datos
 */
async function inicializar() {
  console.log('\n🚀 Inicializando servicio de alertas AEMET...');
  
  const archivoReciente = obtenerArchivoMasReciente();
  
  if (archivoReciente) {
    console.log(`📂 Encontrado archivo de alertas: ${archivoReciente}`);
    estadoSincronizacion.archivoActual = archivoReciente;
    estadoSincronizacion.estado = 'ok';
    estadoSincronizacion.mensaje = `Usando datos de ${archivoReciente}`;
    
    // Leer timestamp del archivo
    const match = archivoReciente.match(/alertas-(\d{4}-\d{2}-\d{2})-(\d{2}-\d{2}-\d{2})\.csv/);
    if (match) {
      const fecha = match[1];
      const hora = match[2].replace(/-/g, ':');
      estadoSincronizacion.ultimaSincronizacion = `${fecha}T${hora}Z`;
    }
    
    console.log('✅ Servicio inicializado con datos existentes\n');
  } else {
    console.log('📥 No se encontraron archivos de alertas. Descargando datos iniciales...\n');
    await descargarAlertasAEMET();
  }
}

// Inicializar al cargar el módulo
inicializar();

module.exports = {
  obtenerAlertasAEMET,
  getEstadoSincronizacion,
  forzarActualizacion
};
