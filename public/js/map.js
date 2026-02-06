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
let sortColumn = null;
let sortAscending = true;

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
    const alertaEnd = alerta.end ? new Date(alerta.end) : null;
    
    // Si la alerta ya ha terminado, no mostrar (para cualquier rango)
    if (alertaEnd && alertaEnd <= now) {
        return null;
    }
    
    switch (rangoAlertas) {
        case 'actual':
            // alertas vigentes: que ya han comenzado Y aún no han terminado
            return alertaStart <= now ? alerta : null;
        case '24h':
            // alertas que comienzan en las próximas 24h (o ya comenzaron) Y aún no han terminado
            const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            return alertaStart <= in24h ? alerta : null;
        case '48h':
            // alertas que comienzan en las próximas 48h (o ya comenzaron) Y aún no han terminado
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
function sortTableData(data, column) {
    const dataToSort = [...data];
    
    if (sortColumn === column) {
        // Si clickean el mismo columna, toggle el orden
        sortAscending = !sortAscending;
    } else {
        // Nueva columna, resetear a ascendente
        sortColumn = column;
        sortAscending = true;
    }
    
    dataToSort.sort((a, b) => {
        let valA, valB;
        const alertaA = obtenerAlertaEnRango(a.alerta);
        const alertaB = obtenerAlertaEnRango(b.alerta);
        
        switch(column) {
            case 'nivel':
                const ordenNiveles = { rojo: 1, naranja: 2, amarillo: 3 };
                valA = ordenNiveles[alertaA.nivel];
                valB = ordenNiveles[alertaB.nivel];
                break;
            case 'sede':
                valA = a.nombre.toLowerCase();
                valB = b.nombre.toLowerCase();
                break;
            case 'tipo':
                valA = a.tipologia.toLowerCase();
                valB = b.tipologia.toLowerCase();
                break;
            case 'direccion':
                valA = a.calle.toLowerCase();
                valB = b.calle.toLowerCase();
                break;
            case 'responsable':
                valA = a.responsable.nombre.toLowerCase();
                valB = b.responsable.nombre.toLowerCase();
                break;
            case 'telefono':
                valA = a.responsable.telefono;
                valB = b.responsable.telefono;
                break;
            case 'fenomeno':
                valA = (alertaA.fenomeno || '').toLowerCase();
                valB = (alertaB.fenomeno || '').toLowerCase();
                break;
            case 'comienzo':
                valA = new Date(alertaA.start || 0).getTime();
                valB = new Date(alertaB.start || 0).getTime();
                break;
            case 'fin':
                valA = new Date(alertaA.end || 0).getTime();
                valB = new Date(alertaB.end || 0).getTime();
                break;
            default:
                return 0;
        }
        
        if (typeof valA === 'string') {
            return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortAscending ? valA - valB : valB - valA;
        }
    });
    
    return dataToSort;
}

function renderizarTablaAlertas(sedes) {
    const tablaContainer = document.getElementById('tablaAlertas');
    
    // Filtrar solo alertas activas (rojo, naranja, amarillo) en el rango temporal seleccionado
    const alertasActivas = sedes
        .filter(sedeVisibleEnTabla)
        .filter(sede => {
            const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
            return alertaEnRango && ['rojo', 'naranja', 'amarillo'].includes(alertaEnRango.nivel);
        });
    
    if (alertasActivas.length === 0) {
        tablaContainer.innerHTML = `
            <div class="sin-alertas">
                <div class="sin-alertas-icon">✅</div>
                <p><strong>No hay alertas activas en este rango temporal</strong></p>
                <p>Todas las sedes tienen nivel de riesgo verde (sin riesgo)</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por nivel de severidad por defecto
    if (!sortColumn) {
        const ordenNiveles = { rojo: 1, naranja: 2, amarillo: 3 };
        alertasActivas.sort((a, b) => {
            const alertaA = obtenerAlertaEnRango(a.alerta);
            const alertaB = obtenerAlertaEnRango(b.alerta);
            return ordenNiveles[alertaA.nivel] - ordenNiveles[alertaB.nivel];
        });
    } else {
        sortTableData(alertasActivas, sortColumn);
    }
    
    let html = `
        <div class="tabla-alertas">
            <table>
                <thead>
                    <tr>
                        <th data-column="nivel" class="${sortColumn === 'nivel' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Nivel</th>
                        <th data-column="sede" class="${sortColumn === 'sede' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Sede</th>
                        <th data-column="tipo" class="${sortColumn === 'tipo' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Tipo</th>
                        <th data-column="direccion" class="${sortColumn === 'direccion' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Dirección</th>
                        <th data-column="responsable" class="${sortColumn === 'responsable' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Responsable</th>
                        <th data-column="telefono" class="${sortColumn === 'telefono' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Teléfono</th>
                        <th data-column="fenomeno" class="${sortColumn === 'fenomeno' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Tipo de Incidente</th>
                        <th data-column="comienzo" class="${sortColumn === 'comienzo' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Comienzo</th>
                        <th data-column="fin" class="${sortColumn === 'fin' ? (sortAscending ? 'sort-asc' : 'sort-desc') : ''}">Fin de Alerta</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Aplicar ordenamiento si está configurado
    const datosOrdenados = sortColumn ? sortTableData(alertasActivas, sortColumn) : alertasActivas;
    
    datosOrdenados.forEach(sede => {
        const alertaEnRango = obtenerAlertaEnRango(sede.alerta);
        const nivelAMostrar = alertaEnRango.nivel;
        const nivelNombre = alertaEnRango.nombre_nivel || alertaEnRango.nombre;
        const fenomeno = alertaEnRango.fenomeno || 'No especificado';
        const comienzo = formatFechaExacta(alertaEnRango.start) || 'No disponible';
        const fin = alertaEnRango.end ? (formatFechaExacta(alertaEnRango.end) || 'No disponible') : 'No especificado';
        
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
                <td><small>${fin}</small></td>
            </tr>
        `;
    });
    
    // Contar por nivel
    const rojasCount = datosOrdenados.filter(s => {
        const a = obtenerAlertaEnRango(s.alerta);
        return a && a.nivel === 'rojo';
    }).length;
    const naranjasCount = datosOrdenados.filter(s => {
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
            <strong>Total de alertas activas:</strong> ${datosOrdenados.length}
            (🔴 Rojas: ${rojasCount}, 
            🟠 Naranjas: ${naranjasCount}, 
            🟡 Amarillas: ${amarillasCount})
        </p>
    `;
    
    tablaContainer.innerHTML = html;
    
    // Añadir event listeners a los headers para ordenamiento
    document.querySelectorAll('.tabla-alertas th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            sortTableData(alertasActivas, column);
            renderizarTablaAlertas(sedes);
        });
    });
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

        // Build fenomeno filters - siempre actualizar con los datos actuales
        buildFenomenoFilters(sedes);

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

// Agregar listeners para los botones de rango temporal
document.querySelectorAll('#rangoAlertasButtons .rango-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remover clase active de todos los botones
        document.querySelectorAll('#rangoAlertasButtons .rango-btn').forEach(b => b.classList.remove('active'));
        // Añadir clase active al botón clickeado
        e.target.closest('.rango-btn').classList.add('active');
        // Actualizar variable global
        rangoAlertas = e.target.closest('.rango-btn').dataset.value;
        // Recargar sedes
        cargarSedes();
    });
});

// Agregar listeners para los botones de modo de datos
document.querySelectorAll('#dataModeButtons .rango-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const mode = e.target.closest('.rango-btn').dataset.value;
        
        try {
            const response = await fetch('/api/config/setmode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: mode })
            });
            
            if (!response.ok) {
                throw new Error('Error al cambiar modo');
            }
            
            const result = await response.json();
            console.log(`✅ Modo cambiado a: ${result.label}`);
            
            // Remover clase active de todos los botones
            document.querySelectorAll('#dataModeButtons .rango-btn').forEach(b => b.classList.remove('active'));
            // Añadir clase active al botón clickeado
            e.target.closest('.rango-btn').classList.add('active');
            
            // Recargar datos
            cargarSedes();
        } catch (err) {
            console.error('❌ Error cambiando modo:', err);
            alert('Error al cambiar el modo de datos');
        }
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
}

// Cargar configuración y mostrar modo de datos en el título
async function cargarConfiguracion() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Actualizar botón de modo de datos con estado actual
        const dataModeButtons = document.querySelectorAll('#dataModeButtons .rango-btn');
        if (dataModeButtons.length > 0) {
            dataModeButtons.forEach(btn => btn.classList.remove('active'));
            const activeBtn = Array.from(dataModeButtons).find(btn => btn.dataset.value === config.data.mode);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    } catch (err) {
        console.error('❌ Error cargando configuración:', err);
    }
}

function buildFenomenoFilters(sedes) {
    const container = document.getElementById('fenomenoFiltersTabla');
    if (!container) return;
    
    // Extraer todos los fenómenos únicos de TODAS las alertas (sin filtrar por rango)
    const fenomenos = new Set();
    sedes.forEach(sede => {
        if (sede.alerta && sede.alerta.fenomeno) {
            fenomenos.add(sede.alerta.fenomeno.toLowerCase());
        }
    });
    
    // Si no hay fenómenos en los datos, usar lista predefinida
    if (fenomenos.size === 0) {
        fenomenos.add('viento');
        fenomenos.add('nieve');
        fenomenos.add('lluvia');
        fenomenos.add('tormenta');
        fenomenos.add('niebla');
    }
    
    container.innerHTML = '';
    container.className = 'fenomeno-filters';
    
    // Reconstruir selectedFenomenos solo con fenómenos actuales
    const fenomenosActuales = new Set();
    Array.from(fenomenos).sort().forEach(fen => {
        const btn = document.createElement('button');
        btn.className = 'fenomeno-btn active';
        btn.dataset.value = fen;
        btn.textContent = fen.charAt(0).toUpperCase() + fen.slice(1);
        
        container.appendChild(btn);
        fenomenosActuales.add(fen);
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                selectedFenomenos.add(fen);
            } else {
                selectedFenomenos.delete(fen);
            }
            renderizarTablaAlertas(todasLasSedes);
        });
    });
    
    // Actualizar selectedFenomenos a los fenómenos actuales
    selectedFenomenos = fenomenosActuales;
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
    container.className = 'tipologia-filters';
    
    tipos.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'tipologia-btn active';
        btn.dataset.value = t;
        btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        btn.title = t;
        
        container.appendChild(btn);
        selectedTipologias.add(t);
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                selectedTipologias.add(t);
            } else {
                selectedTipologias.delete(t);
            }
            cargarSedes();
        });
    });
}

// inicializar controles (listeners)
cargarConfiguracion();
initFilterControls();
actualizarEstadoSincronizacion();
cargarSedes();