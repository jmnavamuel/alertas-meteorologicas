const fetch = require('node-fetch');

const AEMET_API_KEY = process.env.AEMET_API_KEY;
const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';

// Cache de alertas para evitar muchas llamadas a la API
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

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
 * Realiza una petición a la API de AEMET
 */
async function peticionAEMET(url) {
  try {
    const response = await fetch(`${url}?api_key=${AEMET_API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`Error AEMET API: ${response.status}`);
    }
    
    const data = await response.json();
    
    // La API de AEMET devuelve una URL con los datos reales
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
 * Obtiene las alertas meteorológicas de AEMET para una provincia
 */
async function obtenerAlertasAEMET(provincia, codigoPostal) {
  try {
    // Obtener código de provincia
    const codigoProv = provincia || obtenerCodigoProvincia(codigoPostal);
    
    if (!codigoProv) {
      console.warn('No se pudo determinar la provincia para CP:', codigoPostal);
      return NIVELES_ALERTA.verde;
    }
    
    // Verificar cache
    const cacheKey = `alertas_${codigoProv}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    // Obtener alertas de la API
    const url = `${AEMET_BASE_URL}/avisos_cap/ultimoelaborado/area/${codigoProv}`;
    const alertas = await peticionAEMET(url);
    
    if (!alertas || alertas.length === 0) {
      // Sin alertas = verde
      const resultado = {
        ...NIVELES_ALERTA.verde,
        fenomeno: null,
        actualizacion: new Date().toISOString()
      };
      
      cache.set(cacheKey, { data: resultado, timestamp: Date.now() });
      return resultado;
    }
    
    // Procesar alertas y obtener la de mayor nivel
    let nivelMaximo = 'verde';
    let fenomenoActivo = null;
    
    alertas.forEach(alerta => {
      if (alerta.nivel) {
        const nivel = alerta.nivel.toLowerCase();
        
        // Determinar el nivel más alto
        if (nivel === 'rojo' || (nivel === 'naranja' && nivelMaximo !== 'rojo') || 
            (nivel === 'amarillo' && nivelMaximo === 'verde')) {
          nivelMaximo = nivel;
          fenomenoActivo = alerta.fenomeno || alerta.evento || null;
        }
      }
    });
    
    const resultado = {
      ...NIVELES_ALERTA[nivelMaximo],
      fenomeno: fenomenoActivo,
      actualizacion: new Date().toISOString()
    };
    
    // Guardar en cache
    cache.set(cacheKey, { data: resultado, timestamp: Date.now() });
    
    return resultado;
    
  } catch (error) {
    console.error('Error obteniendo alertas AEMET:', error);
    
    // En caso de error, devolver verde con mensaje
    return {
      ...NIVELES_ALERTA.verde,
      fenomeno: 'Error al obtener datos',
      actualizacion: new Date().toISOString()
    };
  }
}

// Limpiar cache cada hora
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
  console.log(`🧹 Cache limpiado. Entradas actuales: ${cache.size}`);
}, 60 * 60 * 1000);

module.exports = {
  obtenerAlertasAEMET
};
