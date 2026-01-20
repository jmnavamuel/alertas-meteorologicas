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
      csv += `${provincia},${datos.nivel},${datos.fenomeno || 'null'},${datos.timestamp}\n`;
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
    const response = await fetch(`${url}?api_key=${AEMET_API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`Error AEMET API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.datos) {
      const datosResponse = await fetch(data.datos);
      return await datosResponse.json();
    }
    
    return data;
  } catch (error) {
    console.error('Error en petición AEMET:', error.message);
    return null;
  }
}

/**
 * Descargar alertas de todas las provincias desde AEMET
 */
async function descargarAlertasAEMET() {
  console.log('🌐 Descargando alertas de AEMET para todas las provincias...');
  
  const alertasPorProvincia = {};
  const provincias = Object.values(CP_TO_PROVINCIA);
  
  for (const provincia of provincias) {
    try {
      const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado/area/${provincia}`;
      const alertas = await peticionAEMET(url);
      
      if (!alertas || alertas.length === 0) {
        alertasPorProvincia[provincia] = {
          nivel: 'verde',
          fenomeno: null,
          timestamp: new Date().toISOString()
        };
      } else {
        let nivelMaximo = 'verde';
        let fenomenoActivo = null;
        
        alertas.forEach(alerta => {
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
      }
      
      console.log(`✅ Provincia ${provincia}: ${alertasPorProvincia[provincia].nivel.toUpperCase()}`);
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error obteniendo alertas para provincia ${provincia}:`, error);
      alertasPorProvincia[provincia] = {
        nivel: 'verde',
        fenomeno: 'Error al obtener datos',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Guardar en archivo
  const nombreArchivo = guardarAlertasEnArchivo(alertasPorProvincia);
  actualizarEstadoSincronizacion(true, `Descarga completada: ${nombreArchivo}`);
  
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
      return NIVELES_ALERTA.verde;
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
    const resultado = {
      ...NIVELES_ALERTA.verde,
      fenomeno: null,
      actualizacion: new Date().toISOString()
    };
    
    return resultado;
    
  } catch (error) {
    console.error('Error obteniendo alertas AEMET:', error);
    
    return {
      ...NIVELES_ALERTA.verde,
      fenomeno: 'Error al obtener datos',
      actualizacion: new Date().toISOString()
    };
  }
}

/**
 * Forzar actualización descargando nuevos datos de AEMET
 */
async function forzarActualizacion() {
  console.log('🔄 Iniciando descarga forzada de datos AEMET...');
  
  // Limpiar cache
  cache.clear();
  
  // Descargar nuevos datos
  await descargarAlertasAEMET();
  
  console.log('✅ Actualización forzada completada');
}

/**
 * Inicialización: cargar archivo más reciente o descargar datos
 */
async function inicializar() {
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
  } else {
    console.log('📥 No se encontraron archivos de alertas. Descargando datos iniciales...');
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
