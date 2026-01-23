require('dotenv').config();
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3100;
const DATA_DIR = path.join(__dirname, '../data');

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

// Leer alertas del CSV generado por el script Python
function leerAlertasDesdeCSV() {
  return new Promise((resolve) => {
    const alertas = {};
    const csvPath = path.join(DATA_DIR, 'alertas-latest.csv');
    
    // Si no existe archivo, devolver objeto vacío (sin alertas)
    if (!fs.existsSync(csvPath)) {
      console.log('⚠️  CSV de alertas no encontrado aún:', csvPath);
      resolve(alertas);
      return;
    }
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const codigo = row.codigo_provincia?.trim();
        if (codigo) {
          alertas[codigo] = {
            nombre: row.nombre_provincia || 'Desconocida',
            nivel: row.nivel || 'verde',
            fenomeno: row.fenomeno !== 'null' ? row.fenomeno : null,
            timestamp: row.timestamp || new Date().toISOString()
          };
        }
      })
      .on('end', () => {
        resolve(alertas);
      })
      .on('error', () => {
        // En caso de error, devolver objeto vacío
        resolve(alertas);
      });
  });
}

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
          tipologia: row.tipologia || 'SSCC',
          calle: row.calle,
          codigoPostal: row.codigo_postal,
          latitud: lat,
          longitud: lon,
          provincia: row.provincia || null,
          responsable: {
            nombre: row.responsable_nombre || 'No especificado',
            telefono: row.responsable_telefono || 'No disponible',
            email: row.responsable_email || 'No disponible'
          }
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

// Endpoint para obtener sedes con alertas desde el CSV de Python
app.get('/api/sedes', async (req, res) => {
  try {
    const sedes = await leerSedes();
    const alertas = await leerAlertasDesdeCSV();
    
    // Asociar alertas a cada sede según su código de provincia
    const sedesConAlertas = sedes.map((sede) => {
      const codigoProvinicia = sede.codigoPostal?.substring(0, 2);
      const alerta = alertas[codigoProvinicia] || { 
        nombre: sede.provincia,
        nivel: 'verde', 
        fenomeno: null, 
        timestamp: new Date().toISOString() 
      };
      
      return {
        ...sede,
        alerta
      };
    });
    
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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Endpoint para obtener alertas (datos procesados por el script Python)
app.get('/api/alertas', async (req, res) => {
  try {
    const alertas = await leerAlertasDesdeCSV();
    res.json(alertas);
  } catch (error) {
    console.error('❌ Error en /api/alertas:', error);
    res.status(500).json({ 
      error: 'Error al cargar las alertas',
      message: error.message 
    });
  }
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
  console.log(`📁 Directorio de datos: ${DATA_DIR}`);
  console.log(`🐍 Las alertas son procesadas por el script Python`);
  console.log(`📊 Lecturas desde: data/alertas-latest.csv`);
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
