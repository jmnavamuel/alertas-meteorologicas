// Inicializar mapa centrado en España
const map = L.map('map').setView([40.4168, -3.7038], 6);

// Guardar las vistas de diferentes regiones
const VISTAS = {
    espana: {
        centro: [40.4168, -3.7038],
        zoom: 6
    },
    canarias: {
        centro: [28.2916, -16.6291],
        zoom: 8
    }
};

// Añadir capa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
}).addTo(map);

// Función para crear icono de marcador personalizado
function crearIconoAlerta(color) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
}

// Cargar y mostrar sedes
async function cargarSedes() {
    try {
        const response = await fetch('/api/sedes');
        const sedes = await response.json();
        
        // Limpiar marcadores anteriores si existen
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        sedes.forEach(sede => {
            const marker = L.marker(
                [sede.latitud, sede.longitud],
                { icon: crearIconoAlerta(sede.alerta.color) }
            ).addTo(map);
            
            const popupContent = `
                <div class="popup-title">${sede.nombre}</div>
                <div class="popup-info">📍 ${sede.calle}</div>
                <div class="popup-info">📮 CP: ${sede.codigoPostal}</div>
                <div class="popup-alerta" style="background-color: ${sede.alerta.color}20; color: ${sede.alerta.color};">
                    ⚠️ Nivel: ${sede.alerta.nombre}
                    ${sede.alerta.fenomeno ? `<br>🌧️ ${sede.alerta.fenomeno}` : ''}
                </div>
            `;
            
            marker.bindPopup(popupContent);
        });
        
        console.log(`✅ ${sedes.length} sedes cargadas correctamente`);
    } catch (error) {
        console.error('Error cargando sedes:', error);
        alert('Error al cargar las sedes. Por favor, recarga la página.');
    }
}

// Cargar sedes al iniciar
cargarSedes();

// Actualizar cada 5 minutos (300000 ms)
setInterval(cargarSedes, 300000);

// Funcionalidad del botón de centrar España
document.getElementById('btnResetMap').addEventListener('click', () => {
    map.flyTo(VISTAS.espana.centro, VISTAS.espana.zoom, {
        duration: 1.5,
        easeLinearity: 0.25
    });
});

// Funcionalidad del botón de Canarias
document.getElementById('btnCanarias').addEventListener('click', () => {
    map.flyTo(VISTAS.canarias.centro, VISTAS.canarias.zoom, {
        duration: 1.5,
        easeLinearity: 0.25
    });
});
