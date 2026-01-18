const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');
const { getAlertaMock } = require('./aemet-mock');

const app = express();
const PORT = process.env.PORT || 3100;

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
    
    // Verificar que existe el archivo
    if (!fs.existsSync(csvPath)) {
      console.error('❌ No se encuentra el archivo CSV:', csvPath);
      reject(new Error('Archivo CSV no encontrado'));
      return;
    }
    
    console.log('📄 Leyendo CSV desde:', csvPath);
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        sedes.push({
          nombre: row.nombre,
          calle: row.calle,
          codigoPostal: row.codigo_postal,
          latitud: parseFloat(row.latitud),
          longitud: parseFloat(row.longitud)
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

// Endpoint para obtener sedes con alertas
app.get('/api/sedes', async (req, res) => {
  try {
    const sedes = await leerSedes();
    
    // Añadir alertas mock a cada sede
    const sedesConAlertas = sedes.map(sede => ({
      ...sede,
      alerta: getAlertaMock(sede.latitud, sede.longitud)
    }));
    
    res.json(sedesConAlertas);
  } catch (error) {
    console.error('❌ Error en /api/sedes:', error);
    res.status(500).json({ 
      error: 'Error al cargar las sedes',
      message: error.message 
    });
  }
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  console.log(`✅ Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log(`📁 Directorio de trabajo: ${__dirname}`);
  console.log(`📂 Directorio public: ${path.join(__dirname, '../public')}`);
  console.log(`📊 Directorio data: ${path.join(__dirname, '../data')}`);
});

// Manejo de señales de cierre
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});