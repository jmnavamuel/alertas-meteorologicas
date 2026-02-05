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
let selectedFenomenos = new Set();
let rangoAlertas = 'actual'; // 'actual', '24h', '48h'

// Filtro solo para el mapa: aplica solo tipología (NUNCA filtra por rango temporal)
function sedeVisibleEnMapa(sede) {
    // tipologia
    if (selectedTipologias.size > 0 && !selectedTipologias.has((sede.tipologia || '').toLowerCase())) {
        return false;
    }
    return true;
}

// Obtener la alerta más severa en el rango temporal seleccionado (o null si no hay)
function obtenerAlertaEnRango(alerta) {
    if (!alerta) return null;
    const now = new Date();
    const alertaStart = new Date(alerta.start || alerta.timestamp);
    
    switch (rangoAlertas) {
        case 'actual':
            // alertas que ya han comenzado
            return alertaStart <= now ? alerta : null;
        case '24h':
            // alertas que comenzarán en las próximas 24 horas (o ya comenzaron)
            const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            return alertaStart <= in24h ? alerta : null;
        case '48h':
            // alertas que comenzarán en las próximas 48 horas (o ya comenzaron)
            const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            return alertaStart <= in48h ? alerta : null;
        default:
            return alerta;
    }
}

// Filtro para la tabla: aplica tipología y fenómeno (pero temporal no oculta)
function sedeVisibleEnTabla(sede) {
    // tipologia
    if (selectedTipologias.size > 0 && !selectedTipologias.has((sede.tipologia || '').toLowerCase())) {
        return false;
    }
    // filtrar por fenomenos seleccionados (solo en tabla, y solo si hay alerta en el rango)
    const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
    if (alertaEnRango && selectedFenomenos.size > 0) {
        if (alertaEnRango.fenomeno) {
            const f = alertaEnRango.fenomeno.toLowerCase();
            // incluir si alguno de los seleccionados aparece en la descripción
            let match = false;
            for (const sel of selectedFenomenos) {
                if (f.includes(sel)) { match = true; break; }
            }
            if (!match) return false;
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
        
        // Mostrar fecha relativa y fecha exacta si está disponible
        if (estado.ultimaSincronizacion) {
            syncTime.textContent = `${formatearFechaRelativa(estado.ultimaSincronizacion)} · ${formatFechaExacta(estado.ultimaSincronizacion)}`;
        } else {
            syncTime.textContent = 'Nunca';
        }
        // Mostrar mensaje y nombre de archivo si está disponible
        syncMessage.textContent = estado.mensaje + (estado.archivo ? ` (${estado.archivo})` : '');
        
    } catch (error) {
        console.error('Error actualizando estado de sincronización:', error);
    }
}

// Formatear fecha exacta para mostrar timestamp legible
function formatFechaExacta(isoString) {
    if (!isoString) return '';
    try {
        const fecha = new Date(isoString);
        return fecha.toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) {
        return isoString;
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
    
    // Calcular estadísticas basándose en las sedes filtradas por mapa (solo tipología)
    // Pero usar la alerta EN RANGO para determinar el nivel a mostrar
    const visibles = Array.from(todasLasSedes).filter(sedeVisibleEnMapa);
    const totalSedes = visibles.length;
    
    let rojo = 0, naranja = 0, amarillo = 0, verde = 0;
    visibles.forEach(sede => {
        const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
        const nivelAMostrar = alertaEnRango ? alertaEnRango.nivel : 'verde';
        if (nivelAMostrar === 'rojo') rojo++;
        else if (nivelAMostrar === 'naranja') naranja++;
        else if (nivelAMostrar === 'amarillo') amarillo++;
        else verde++;
    });
    
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
    
    // Filtrar TODAS las sedes visibles en tabla (tipología + fenómeno aplicados a la alerta EN RANGO)
    const sedesVisibles = sedes.filter(sedeVisibleEnTabla);
    
    if (sedesVisibles.length === 0) {
        tablaContainer.innerHTML = `
            <div class="sin-alertas">
                <div class="sin-alertas-icon">✅</div>
                <p><strong>No hay alertas en este rango temporal</strong></p>
                <p>Ajusta los filtros para ver más sedes</p>
            </div>
        `;
        return;
    }
    
    // Ordenar: primero las que tienen alerta en rango (ordenadas por nivel), luego las verdes
    const ordenNiveles = { rojo: 1, naranja: 2, amarillo: 3, verde: 4 };
    sedesVisibles.sort((a, b) => {
        const alertaA = obtenerAlertaEnRango(a.alerta);
        const alertaB = obtenerAlertaEnRango(b.alerta);
        const nivelA = alertaA ? alertaA.nivel : 'verde';
        const nivelB = alertaB ? alertaB.nivel : 'verde';
        return ordenNiveles[nivelA] - ordenNiveles[nivelB];
    });
    
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
                        <th>Comienzo</th>
                        <th>Actualización</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sedesVisibles.forEach(sede => {
        const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
        const nivelAMostrar = alertaEnRango ? alertaEnRango.nivel : 'verde';
        const nivelNombre = alertaEnRango ? (alertaEnRango.nombre_nivel || alertaEnRango.nombre) : 'Verde';
        const fenomeno = alertaEnRango && alertaEnRango.fenomeno ? alertaEnRango.fenomeno : 'Sin alerta';
        const comienzo = alertaEnRango && alertaEnRango.start ? (formatFechaExacta(alertaEnRango.start) || 'No disponible') : '—';
        const actualizacion = alertaEnRango ? formatearFechaRelativa(alertaEnRango.timestamp) : '—';
        
        html += `
            <tr>
                <td>
                    <span class="nivel-badge ${nivelAMostrar}">
                        ${nivelNombre}
                    </span>
                </td>
                <td><strong>${sede.nombre}</strong></td>
                <td>${sede.tipologia}</td>
                <td>${sede.calle}</td>
                <td>${sede.responsable.nombre}</td>
                <td>${sede.responsable.telefono}</td>
                <td>${fenomeno}</td>
                <td><small>${comienzo}</small></td>
                <td><small>${actualizacion}</small></td>
            </tr>
        `;
    });
    
    // Contar alertas activas (no verdes)
    const alertasActivas = sedesVisibles.filter(sede => {
        const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
        return alertaEnRango && alertaEnRango.nivel !== 'verde';
    });
    
    const rojasCount = alertasActivas.filter(s => {
        const a = obtenerAlertaEnRango(s.alerta);
        return a && a.nivel === 'rojo';
    }).length;
    const naranjasCount = alertasActivas.filter(s => {
        const a = obtenerAlertaEnRango(s.alerta);
        return a && a.nivel === 'naranja';
    }).length;
    const amarillasCount = alertasActivas.filter(s => {
        const a = obtenerAlertaEnRango(s.alerta);
        return a && a.nivel === 'amarillo';
    }).length;
    
    html += `
                </tbody>
            </table>
        </div>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
            <strong>Total sedes:</strong> ${sedesVisibles.length} | 
            <strong>Alertas activas:</strong> ${alertasActivas.length}
            (🔴 Rojas: ${rojasCount}, 
            🟠 Naranjas: ${naranjasCount}, 
            🟡 Amarillas: ${amarillasCount})
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

        // aplicar filtros y añadir marcadores para TODOS los visibles en el mapa
        const visibles = sedes.filter(sedeVisibleEnMapa);
        visibles.forEach(sede => {
            // Usar la alerta en rango temporal para determinar el color
            const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
            const nivelAMostrar = alertaEnRango ? alertaEnRango.nivel : 'verde';
            const colorMarker = obtenerColorAlerta(nivelAMostrar);
            
            const marker = L.marker(
                [sede.latitud, sede.longitud],
                { icon: crearIconoAlerta(colorMarker) }
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
                <div class="popup-alerta" style="background-color: ${colorMarker}20; color: ${colorMarker};">
                    ⚠️ Nivel: ${alertaEnRango ? (alertaEnRango.nombre_nivel || alertaEnRango.nombre) : 'Sin alerta en este rango'}
                    ${alertaEnRango && alertaEnRango.fenomeno ? `<br>🌧️ ${alertaEnRango.fenomeno}` : ''}
                </div>
            `;

            marker.bindPopup(popupContent);
        });

        // renderizar tabla con todas las sedes (se aplican filtros dentro de renderizarTablaAlertas)
        renderizarTablaAlertas(todasLasSedes);
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

// Agregar listeners para los filtros de rango temporal
document.querySelectorAll('input[name="rangoAlertas"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        rangoAlertas = e.target.value;
        cargarSedes();
    });
});

// Actualizar estado de sincronización cada 30 segundos (para mostrar cuándo se actualizaron datos)
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
    const fenContainerTabla = document.getElementById('fenomenoFiltersTabla');
    if (fenContainerTabla) {
        // Inicializar selectedFenomenos con todos los checkboxes marcados por defecto
        const boxes = Array.from(fenContainerTabla.querySelectorAll('input[type="checkbox"]'));
        boxes.forEach(cb => {
            if (cb.checked) selectedFenomenos.add(cb.value);
            cb.addEventListener('change', () => {
                selectedFenomenos = new Set(Array.from(fenContainerTabla.querySelectorAll('input:checked')).map(i => i.value));
                renderizarTablaAlertas(todasLasSedes);
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