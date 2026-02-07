require('dotenv').config();
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const ini = require('ini');

const app = express();
const PORT = process.env.PORT || 3100;
const DATA_DIR = path.join(__dirname, '../data');

// Cargar configuración desde config.ini
const configPath = path.join(__dirname, '../config.ini');
let config = {
  data: { mode: 'real' },
  scheduler: { interval_minutes: 60 },
  logging: { level: 'info' }
};

if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = ini.parse(configContent);
  console.log(`📋 Configuración cargada desde: config.ini (modo: ${config.data?.mode || 'real'})`);
} else {
  console.log('⚠️  config.ini no encontrado, usando valores por defecto');
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

// Mapa de nombres descriptivos para niveles de alerta
const NOMBRES_NIVEL = {
  rojo: 'Riesgo Extremo',
  naranja: 'Importante',
  amarillo: 'Advertencia',
  verde: 'Sin riesgo'
};

// Buscar el archivo alertas-*.csv más reciente en DATA_DIR
function findLatestAlertsFile() {
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.match(/^alertas-\d{8}-\d{4}\.csv$/))
      .map(f => ({
        name: f,
        path: path.join(DATA_DIR, f),
        mtime: fs.statSync(path.join(DATA_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0].path : null;
  } catch (err) {
    console.error('❌ Error buscando archivo de alertas:', err.message);
    return null;
  }
}

// Seleccionar archivo de alertas según configuración (relee config.ini en cada petición)
function getAlertsFilePath() {
  // Releer config.ini para detectar cambios sin reiniciar
  let currentConfig = {
    data: { mode: 'real' },
    scheduler: { interval_minutes: 60 },
    logging: { level: 'info' }
  };
  
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      currentConfig = ini.parse(configContent);
    }
  } catch (err) {
    console.error('⚠️  Error leyendo config.ini en getAlertsFilePath:', err.message);
  }
  
  const dataMode = currentConfig.data?.mode || 'real';
  
  if (dataMode === 'dummy') {
    const dummyPath = path.join(DATA_DIR, 'alertas_dummy.csv');
    if (fs.existsSync(dummyPath)) {
      console.log('🔷 Modo DUMMY: usando alertas_dummy.csv');
      return dummyPath;
    } else {
      console.warn('⚠️  Archivo dummy no encontrado, buscando alertas reales');
    }
  }
  
  const realPath = findLatestAlertsFile();
  if (realPath) {
    console.log('🔴 Modo REAL: usando ' + path.basename(realPath));
  }
  return realPath;
}

// Leer alertas del CSV generado por el script Python
function leerAlertasDesdeCSV() {
  return new Promise((resolve) => {
    const alertas = {};
    const csvPath = getAlertsFilePath();
    if (!csvPath) {
      console.log('⚠️  CSV de alertas no encontrado en:', DATA_DIR);
      resolve(alertas);
      return;
    }
    console.log('📖 Leyendo alertas desde:', path.basename(csvPath));
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const codigo = row.codigo_provincia?.trim();
        if (codigo) {
          const nivel = (row.nivel || 'verde').toLowerCase();
          alertas[codigo] = {
            nombre: row.nombre_provincia || 'Desconocida',
            nivel: nivel,
            nombre_nivel: NOMBRES_NIVEL[nivel] || 'Desconocido',
            fenomeno: row.fenomeno !== 'null' ? row.fenomeno : null,
            start: row.start || row.timestamp || new Date().toISOString(),
            end: row.end || row.timestamp || new Date().toISOString(),
            timestamp: row.timestamp || new Date().toISOString()
          };
        }
      })
      .on('end', () => {
        console.log(`✅ Alertas cargadas: ${Object.keys(alertas).length} provincias`);
        resolve(alertas);
      })
      .on('error', (err) => {
        console.error('⚠️  Error leyendo CSV:', err.message);
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

// Obtener estado de sincronización
function getLatestAemetFileTime() {
  try {
    const alertasDir = path.join(__dirname, '../data/alertas');
    if (!fs.existsSync(alertasDir)) return null;
    const files = fs.readdirSync(alertasDir)
      .map(f => ({f, mtime: fs.statSync(path.join(alertasDir, f)).mtimeMs}))
      .sort((a,b) => b.mtime - a.mtime);
    if (!files.length) return null;
    return new Date(files[0].mtime).toISOString();
  } catch (e) {
    return null;
  }
}

function getLatestAemetFileInfo() {
  try {
    const alertasDir = path.join(__dirname, '../data/alertas');
    if (!fs.existsSync(alertasDir)) return null;
    
    const files = fs.readdirSync(alertasDir)
      .filter(f => f.match(/^alertas-\d{8}-\d{4}\.csv$/))
      .map(f => {
        // Parsear la fecha del nombre del archivo: alertas-YYYYMMDD-HHMM.csv
        const match = f.match(/alertas-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
        if (!match) return null;
        
        const [, year, month, day, hour, minute] = match;
        const dateISO = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
        const timestamp = new Date(dateISO).getTime();
        
        return { 
          name: f, 
          path: path.join(alertasDir, f), 
          timestamp: timestamp,
          dateISO: dateISO
        };
      })
      .filter(f => f !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (!files.length) return null;
    return { filename: files[0].name, mtimeISO: files[0].dateISO };
  } catch (e) {
    console.error('❌ Error obteniendo info de alertas:', e.message);
    return null;
  }
}

app.get('/api/sincronizacion/estado', (req, res) => {
  const info = getLatestAemetFileInfo();
  if (info) {
    res.json({ estado: 'ok', ultimaSincronizacion: info.mtimeISO, archivo: info.filename, mensaje: 'Última sincronización detectada' });
  } else {
    res.json({ estado: 'idle', ultimaSincronizacion: null, archivo: null, mensaje: 'No hay sincronizaciones registradas aún' });
  }
});

// Endpoint para obtener configuración actual (incluyendo modo de datos)
app.get('/api/config', (req, res) => {
  // Releer config.ini en cada petición para detectar cambios sin reiniciar
  let currentConfig = {
    data: { mode: 'real' },
    scheduler: { interval_minutes: 60 },
    logging: { level: 'info' }
  };
  
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      currentConfig = ini.parse(configContent);
    }
  } catch (err) {
    console.error('⚠️  Error leyendo config.ini en endpoint:', err.message);
  }
  
  const dataMode = currentConfig.data?.mode || 'real';
  const modeLabel = dataMode === 'dummy' ? '🔷 Datos de Prueba' : '🔴 Datos Reales AEMET';
  
  res.json({
    data: {
      mode: dataMode,
      label: modeLabel
    },
    scheduler: {
      interval_minutes: parseInt(currentConfig.scheduler?.interval_minutes) || 60
    },
    logging: {
      level: currentConfig.logging?.level || 'info'
    }
  });
});

// Endpoint para cambiar el modo de datos
app.post('/api/config/setmode', express.json(), (req, res) => {
  const { mode } = req.body;
  
  if (!mode || !['dummy', 'real'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido. Debe ser "dummy" o "real"' });
  }
  
  try {
    // Leer config.ini actual
    let configContent = '';
    if (fs.existsSync(configPath)) {
      configContent = fs.readFileSync(configPath, 'utf-8');
    }
    
    // Parsear configuración
    let currentConfig = ini.parse(configContent);
    
    // Actualizar modo
    if (!currentConfig.data) currentConfig.data = {};
    currentConfig.data.mode = mode;
    
    // Serializar back a INI
    const newContent = ini.stringify(currentConfig);
    
    // Escribir al archivo
    fs.writeFileSync(configPath, newContent, 'utf-8');
    
    const modeLabel = mode === 'dummy' ? '🔷 Datos de Prueba' : '🔴 Datos Reales AEMET';
    console.log(`✅ Modo de datos cambiado a: ${mode} (${modeLabel})`);
    
    res.json({
      success: true,
      mode: mode,
      label: modeLabel,
      message: `Modo cambiado a ${modeLabel}`
    });
  } catch (err) {
    console.error('❌ Error cambiando modo:', err.message);
    res.status(500).json({ error: 'Error al cambiar el modo de datos', message: err.message });
  }
});

// Programar sincronización cada hora (ejecución automática)
// Ejecuta el script Python del downloader al iniciar y luego cada hora
function runDownloaderAndLog() {
  const cmd = 'python3 src/downloader/alert_downloader.py';
  exec(cmd, { cwd: path.join(__dirname, '..'), timeout: 5 * 60 * 1000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error ejecutando downloader programado:', error.message);
      if (stderr) console.error(stderr);
      return;
    }
    console.log('✅ Downloader programado ejecutado correctamente');
    if (stdout) console.log(stdout);
  });
}
function scheduleHourlySync() {
  // Ejecutar inmediatamente al arrancar y luego cada hora
  try {
    runDownloaderAndLog();
    const intervalMs = (parseInt(config.scheduler?.interval_minutes) || 60) * 60 * 1000;
    setInterval(runDownloaderAndLog, intervalMs);
    console.log(`⏱️  Sincronización programada cada ${config.scheduler?.interval_minutes || 60} minuto(s)`);
  } catch (e) {
    console.error('❌ Error al programar sincronización:', e.message);
  }
}
// Iniciar el scheduler
scheduleHourlySync();

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
