require('dotenv').config();
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');
const { obtenerAlertasAEMET, getEstadoSincronizacion, forzarActualizacion } = require('./aemet-service');

const app = express();
const PORT = process.env.PORT || 3100;

// Verificar que existe la API Key
if (!process.env.AEMET_API_KEY || process.env.AEMET_API_KEY === 'your_api_key_here' || process.env.AEMET_API_KEY === 'TU_API_KEY_REAL_AQUI') {
  console.error('❌ ERROR: No se ha configurado la API Key de AEMET');
  console.error('Por favor, edita el archivo .env con tu AEMET_API_KEY');
  console.error('Ejemplo: AEMET_API_KEY=tu_clave_aqui');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Servir archivos estáticos con Content-Type correcto
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Ruta explícita para index.html
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Leer sedes del CSV
function leerSedes() {
  return new Promise((resolve, reject) => {
    const sedes = [];
    const csvPath = path.join(__dirname, '../data/sedes.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ No se encuentra el archivo CSV:', csvPath);
      reject(new Error('Archivo CSV no encontrado'));
      return;
    }
    
    console.log('📄 Leyendo CSV desde:', csvPath);
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const lat = parseFloat(row.latitud);
        const lon = parseFloat(row.longitud);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          console.warn('⚠️  Omitiendo sede con coordenadas inválidas:', row.nombre, row.latitud, row.longitud);
          return;
        }

        sedes.push({
          nombre: row.nombre,
          calle: row.calle,
          codigoPostal: row.codigo_postal,
          latitud: lat,
          longitud: lon,
          provincia: row.provincia || null
        });
      })
      .on('end', () => {
        console.log(`✅ ${sedes.length} sedes leídas del CSV`);
        resolve(sedes);
      })
      .on('error', (err) => {
        console.error('❌ Error leyendo CSV:', err);
        reject(err);
      });
  });
}

// Endpoint para obtener sedes con alertas reales de AEMET
app.get('/api/sedes', async (req, res) => {
  try {
    const sedes = await leerSedes();
    
    // Obtener alertas reales de AEMET para cada sede
    const sedesConAlertas = await Promise.all(
      sedes.map(async (sede) => {
        const alerta = await obtenerAlertasAEMET(sede.provincia, sede.codigoPostal);
        return {
          ...sede,
          alerta
        };
      })
    );
    
    res.json(sedesConAlertas);
  } catch (error) {
    console.error('❌ Error en /api/sedes:', error);
    res.status(500).json({ 
      error: 'Error al cargar las sedes',
      message: error.message 
    });
  }
});

// Endpoint para obtener estado de sincronización
app.get('/api/sincronizacion/estado', (req, res) => {
  const estado = getEstadoSincronizacion();
  res.json(estado);
});

// Endpoint para forzar actualización
app.post('/api/sincronizacion/forzar', async (req, res) => {
  try {
    console.log('🔄 Forzando actualización manual de datos AEMET...');
    await forzarActualizacion();
    const estado = getEstadoSincronizacion();
    res.json({ 
      success: true, 
      mensaje: 'Actualización completada',
      estado 
    });
  } catch (error) {
    console.error('❌ Error forzando actualización:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al forzar actualización',
      message: error.message 
    });
  }
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.AEMET_API_KEY
  });
});

// Endpoint para verificar configuración
app.get('/api/config/status', (req, res) => {
  res.json({
    apiKeyConfigured: !!process.env.AEMET_API_KEY && 
                      process.env.AEMET_API_KEY !== 'your_api_key_here' && 
                      process.env.AEMET_API_KEY !== 'TU_API_KEY_REAL_AQUI',
    nodeEnv: process.env.NODE_ENV,
    port: PORT
  });
});

// Manejo de errores global
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   🌦️  SISTEMA DE ALERTAS METEOROLÓGICAS AEMET  🌦️   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`✅ Servidor iniciado en http://0.0.0.0:${PORT}`);
  console.log(`📁 Directorio de trabajo: ${__dirname}`);
  console.log(`🔑 API Key AEMET: ${process.env.AEMET_API_KEY && process.env.AEMET_API_KEY !== 'your_api_key_here' && process.env.AEMET_API_KEY !== 'TU_API_KEY_REAL_AQUI' ? '✅ Configurada' : '❌ NO configurada'}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════════════');
});

// Manejo de señales de cierre
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});
