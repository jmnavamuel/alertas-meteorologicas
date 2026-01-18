// Simulador de alertas AEMET
// En producción, esto se conectará a la API real de AEMET

const NIVELES_ALERTA = {
  VERDE: { color: '#28a745', nivel: 'verde', nombre: 'Sin riesgo' },
  AMARILLO: { color: '#ffc107', nivel: 'amarillo', nombre: 'Riesgo' },
  NARANJA: { color: '#fd7e14', nivel: 'naranja', nombre: 'Riesgo importante' },
  ROJO: { color: '#dc3545', nivel: 'rojo', nombre: 'Riesgo extremo' }
};

function getAlertaMock(lat, lon) {
  // Simulación: genera alertas aleatorias pero consistentes por ubicación
  const seed = Math.floor(lat * 1000 + lon * 1000);
  const random = Math.abs(Math.sin(seed)) * 100;
  
  let alerta;
  if (random < 60) {
    alerta = NIVELES_ALERTA.VERDE;
  } else if (random < 80) {
    alerta = NIVELES_ALERTA.AMARILLO;
  } else if (random < 95) {
    alerta = NIVELES_ALERTA.NARANJA;
  } else {
    alerta = NIVELES_ALERTA.ROJO;
  }
  
  return {
    ...alerta,
    fenomeno: random < 60 ? null : obtenerFenomenoAleatorio(seed),
    actualizacion: new Date().toISOString()
  };
}

function obtenerFenomenoAleatorio(seed) {
  const fenomenos = [
    'Lluvias intensas',
    'Viento fuerte',
    'Nevadas',
    'Tormentas',
    'Temperaturas extremas',
    'Fenómenos costeros'
  ];
  return fenomenos[Math.floor(Math.abs(Math.sin(seed * 2)) * fenomenos.length)];
}

module.exports = { getAlertaMock };
