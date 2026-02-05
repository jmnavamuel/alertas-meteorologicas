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

// Variable global para almacenar todas las sedes
let todasLasSedes = [];

// Estado de filtros
let selectedTipologias = new Set();
let excludedFenomenos = new Set();

function sedeVisible(sede) {
    // tipologia
    if (selectedTipologias.size > 0 && !selectedTipologias.has((sede.tipologia || '').toLowerCase())) {
        return false;
    }
    // excluir fenomenos
    if (sede.alerta && sede.alerta.fenomeno) {
        const f = sede.alerta.fenomeno.toLowerCase();
        for (const ex of excludedFenomenos) {
            if (f.includes(ex)) return false;
        }
    }
    return true;
}

// Mapa de colores para los niveles de alerta
const COLORES_ALERTA = {
    rojo: '#DC143C',      // Crimson
    naranja: '#FF8C00',   // Dark Orange
    amarillo: '#FFD700',  // Gold
    verde: '#32CD32'      // Lime Green
};

// Función para obtener color según el nivel
function obtenerColorAlerta(nivel) {
    return COLORES_ALERTA[nivel] || COLORES_ALERTA.verde;
}

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

// Función para formatear fecha relativa
function formatearFechaRelativa(isoString) {
    if (!isoString) return 'Nunca';
    
    const fecha = new Date(isoString);
    const ahora = new Date();
    const diff = Math.floor((ahora - fecha) / 1000);
    
    if (diff < 60) return `Hace ${diff} segundos`;
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    
    return fecha.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Actualizar estado de sincronización
async function actualizarEstadoSincronizacion() {
    try {
        const response = await fetch('/api/sincronizacion/estado');
        const estado = await response.json();
        
        const syncIcon = document.getElementById('syncIcon');
        const syncTime = document.getElementById('syncTime');
        const syncMessage = document.getElementById('syncMessage');
        
        if (estado.estado === 'ok') {
            syncIcon.textContent = '✅';
            syncIcon.className = 'sync-icon ok';
            syncMessage.className = 'sync-message ok';
        } else if (estado.estado === 'error') {
            syncIcon.textContent = '❌';
            syncIcon.className = 'sync-icon error';
            syncMessage.className = 'sync-message error';
        } else {
            syncIcon.textContent = '⏳';
            syncIcon.className = 'sync-icon';
            syncMessage.className = 'sync-message';
        }
        
        syncTime.textContent = formatearFechaRelativa(estado.ultimaSincronizacion);
        syncMessage.textContent = estado.mensaje;
        
    } catch (error) {
        console.error('Error actualizando estado de sincronización:', error);
    }
}

// Actualizar estadísticas en la leyenda
function actualizarEstadisticas() {
    const estadisticasDiv = document.getElementById('estadisticas');
    
    if (!todasLasSedes || todasLasSedes.length === 0) {
        estadisticasDiv.innerHTML = `
            <p style="margin-bottom: 5px; font-size: 12px;">
                <strong>Cargando datos...</strong>
            </p>
        `;
        return;
    }
    
    // Calcular estadísticas basándose en las sedes filtradas
    const visibles = Array.from(todasLasSedes).filter(sedeVisible);
    const totalSedes = visibles.length;
    const rojo = visibles.filter(s => s.alerta.nivel === 'rojo').length;
    const naranja = visibles.filter(s => s.alerta.nivel === 'naranja').length;
    const amarillo = visibles.filter(s => s.alerta.nivel === 'amarillo').length;
    const verde = visibles.filter(s => s.alerta.nivel === 'verde').length;
    const totalAlertas = rojo + naranja + amarillo;
    
    estadisticasDiv.innerHTML = `
        <div style="margin-bottom: 12px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold;">
                📊 Estadísticas de Alertas
            </p>
            <div style="font-size: 12px; margin-bottom: 8px;">
                <strong>Total sedes:</strong> ${totalSedes}
            </div>
            <div style="font-size: 12px; margin-bottom: 8px;">
                <strong>Alertas activas:</strong> ${totalAlertas}
            </div>
            <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
                <div>🔴 <strong>${rojo}</strong> Rojas</div>
                <div>🟠 <strong>${naranja}</strong> Naranjas</div>
                <div>🟡 <strong>${amarillo}</strong> Amarillas</div>
                <div>🟢 <strong>${verde}</strong> Verdes</div>
            </div>
        </div>
    `;
}

// Función para renderizar tabla de alertas activas
function renderizarTablaAlertas(sedes) {
    const tablaContainer = document.getElementById('tablaAlertas');
    
    const alertasActivas = sedes.filter(sede => 
        sede.alerta.nivel !== 'verde'
    );
    
    if (alertasActivas.length === 0) {
        tablaContainer.innerHTML = `
            <div class="sin-alertas">
                <div class="sin-alertas-icon">✅</div>
                <p><strong>No hay alertas activas en este momento</strong></p>
                <p>Todas las sedes tienen nivel de riesgo verde (sin riesgo)</p>
            </div>
        `;
        return;
    }
    
    const ordenNiveles = { rojo: 1, naranja: 2, amarillo: 3 };
    alertasActivas.sort((a, b) => 
        ordenNiveles[a.alerta.nivel] - ordenNiveles[b.alerta.nivel]
    );
    
    let html = `
        <div class="tabla-alertas">
            <table>
                <thead>
                    <tr>
                        <th>Nivel</th>
                        <th>Sede</th>
                        <th>Tipo</th>
                        <th>Dirección</th>
                        <th>Responsable</th>
                        <th>Teléfono</th>
                        <th>Tipo de Incidente</th>
                        <th>Actualización</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    alertasActivas.forEach(sede => {
        const nivelClass = sede.alerta.nivel;
        const nivelNombre = sede.alerta.nombre;
        const fenomeno = sede.alerta.fenomeno || 'No especificado';
        const actualizacion = formatearFechaRelativa(sede.alerta.actualizacion);
        
        html += `
            <tr>
                <td>
                    <span class="nivel-badge ${nivelClass}">
                        ${nivelNombre}
                    </span>
                </td>
                <td><strong>${sede.nombre}</strong></td>
                <td>${sede.tipologia}</td>
                <td>${sede.calle}</td>
                <td>${sede.responsable.nombre}</td>
                <td>${sede.responsable.telefono}</td>
                <td>${fenomeno}</td>
                <td><small>${actualizacion}</small></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
            <strong>Total de alertas activas:</strong> ${alertasActivas.length} 
            (🔴 Rojas: ${alertasActivas.filter(s => s.alerta.nivel === 'rojo').length}, 
            🟠 Naranjas: ${alertasActivas.filter(s => s.alerta.nivel === 'naranja').length}, 
            🟡 Amarillas: ${alertasActivas.filter(s => s.alerta.nivel === 'amarillo').length})
        </p>
    `;
    
    tablaContainer.innerHTML = html;
}

// Cargar y mostrar sedes
async function cargarSedes() {
    try {
        const response = await fetch('/api/sedes');
        const sedes = await response.json();

        todasLasSedes = sedes;

        // Build tipologia filters once
        if (document.getElementById('tipologiaFilters') && document.getElementById('tipologiaFilters').children.length === 0) {
            buildTipologiaFilters(sedes);
        }

        // limpiar marcadores
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // aplicar filtros y añadir marcadores solamente para los visibles
        const visibles = sedes.filter(sedeVisible);
        visibles.forEach(sede => {
            const marker = L.marker(
                [sede.latitud, sede.longitud],
                { icon: crearIconoAlerta(obtenerColorAlerta(sede.alerta.nivel)) }
            ).addTo(map);

            const popupContent = `
                <div class="popup-title">${sede.nombre}</div>
                <div class="popup-info">🏢 Tipo: ${sede.tipologia}</div>
                <div class="popup-info">📍 ${sede.calle}</div>
                <div class="popup-info">📮 CP: ${sede.codigoPostal}</div>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                <div class="popup-info"><strong>Responsable:</strong></div>
                <div class="popup-info">👤 ${sede.responsable.nombre}</div>
                <div class="popup-info">📞 ${sede.responsable.telefono}</div>
                <div class="popup-info">📧 ${sede.responsable.email}</div>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                <div class="popup-alerta" style="background-color: ${obtenerColorAlerta(sede.alerta.nivel)}20; color: ${obtenerColorAlerta(sede.alerta.nivel)};">
                    ⚠️ Nivel: ${sede.alerta.nombre_nivel || sede.alerta.nombre}
                    ${sede.alerta.fenomeno ? `<br>🌧️ ${sede.alerta.fenomeno}` : ''}
                </div>
            `;

            marker.bindPopup(popupContent);
        });

        // renderizar tabla con las sedes visibles
        renderizarTablaAlertas(visibles);
        actualizarEstadisticas();
        await actualizarEstadoSincronizacion();

        console.log(`✅ ${sedes.length} sedes cargadas correctamente (${visibles.length} visibles según filtros)`);
    } catch (error) {
        console.error('Error cargando sedes:', error);
        document.getElementById('tablaAlertas').innerHTML = `
            <div class="sin-alertas">
                <div class="sin-alertas-icon">❌</div>
                <p><strong>Error al cargar las alertas</strong></p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Cargar sedes al iniciar
cargarSedes();

// Actualizar cada 5 minutos (300000 ms)
setInterval(cargarSedes, 300000);

// Actualizar estado de sincronización cada 30 segundos
setInterval(actualizarEstadoSincronizacion, 30000);

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

// Inicializar controles de filtro (tipologías y fenómenos)
function initFilterControls() {
    const tipologiaContainer = document.getElementById('tipologiaFilters');
    if (tipologiaContainer) {
        tipologiaContainer.innerHTML = '';
    }
    const fenContainer = document.getElementById('fenomenoFilters');
    if (fenContainer) {
        fenContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                excludedFenomenos = new Set(Array.from(fenContainer.querySelectorAll('input:checked')).map(i => i.value));
                cargarSedes();
            });
        });
    }
}

function buildTipologiaFilters(sedes) {
    const container = document.getElementById('tipologiaFilters');
    if (!container) return;
    const tipos = Array.from(new Set(sedes.map(s => (s.tipologia || '').toLowerCase()).filter(Boolean))).sort();
    if (!tipos.length) {
        container.innerHTML = '<small>No hay tipologías</small>';
        return;
    }
    container.innerHTML = '';
    tipos.forEach(t => {
        const id = `tip-${t.replace(/[^a-z0-9]/g, '_')}`;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<label><input type="checkbox" id="${id}" value="${t}" checked> ${t}</label>`;
        container.appendChild(wrapper);
        const cb = wrapper.querySelector('input');
        selectedTipologias.add(t);
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedTipologias.add(t); else selectedTipologias.delete(t);
            cargarSedes();
        });
    });
}

// inicializar controles (listeners)
initFilterControls();