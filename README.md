# 🌦️ Sistema de Alertas Meteorológicas AEMET

Sistema de monitorización en tiempo real de alertas meteorológicas de AEMET para múltiples sedes distribuidas por España.

![Versión](https://img.shields.io/badge/versión-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![Licencia](https://img.shields.io/badge/licencia-MIT-orange)

## 📋 Características

- ✅ **API Real de AEMET**: Conexión directa con la API oficial de AEMET
- 🗺️ **Mapa Interactivo**: Visualización con Leaflet.js
- 🎨 **4 Niveles de Alerta**: Verde, Amarillo, Naranja y Rojo
- 🔄 **Actualización Automática Horaria**: Descarga de datos cada hora automáticamente (sin necesidad de botón manual)
- 📊 **Frontend Eficiente**: Se carga una sola vez al inicio, sin refresco automático constante
- 💾 **Filtrado Inteligente**: 
  - Filtros por tipología de sede (SSCC, Delegación, Clínica Dental, Centro Médico, **Datacenter**)
  - Filtros de fenómenos solo en tabla (no afecta al mapa)
- 🐳 **Dockerizado**: Fácil despliegue con Docker Compose
- 📱 **Responsive**: Adaptado a móviles y tablets
- 🏝️ **Multi-región**: Soporte para Península y Canarias

---

---

## 🎯 Modo de Funcionamiento

### 🔄 Actualización de Datos AEMET

El sistema descarga datos de la API de AEMET **automáticamente cada hora** sin necesidad de intervención manual:

1. ⏲️ **Al iniciar el servidor**: Se ejecuta inmediatamente una descarga
2. 🔁 **Cada hora**: Se ejecuta automáticamente el script `alert_downloader.py`
3. 📥 **Descarga**: Obtiene datos CAP (Common Alerting Protocol) de AEMET en formato XML
4. 💾 **Procesamiento**: Convierte los datos a CSV con información de fecha de inicio y fin de alerta
5. 📊 **Frontend**: 
   - Se carga una sola vez al iniciar la página
   - Muestra todos los datos (sedes y alertas) del CSV más reciente
   - **Para ver nuevas alertas después de una descarga**, recarga la página (F5 o Cmd+R)

### 🗺️ Interfaz Web

La interfaz principal muestra:

| Sección | Función |
|---------|---------|
| **Mapa** | Marcadores con código de colores indicando nivel de alerta en cada sede (SIEMPRE se muestran todas) |
| **Leyenda (sidebar)** | Estadísticas de alertas activas, filtros por tipología de sede y selector de rango temporal |
| **Rango Temporal** | Selector radio para "Alertas Actuales", "Próximas 24h" o "Próximas 48h" |
| **Filtros de Tipología** | Checkboxes para filtrar qué tipos de sedes se muestran (afecta a mapa y tabla) |
| **Tabla de Alertas** | Lista de sedes CON ALERTAS ACTIVAS (solo rojo, naranja, amarillo - no verdes) |
| **Filtros de Fenómenos** | Checkboxes para filtrar tipos de fenómenos en la tabla (solo afecta a la tabla, no al mapa) |

### 🎨 Niveles de Alerta y Colores

```
🟢 Verde     = Sin riesgo (Latitud: Verde) — No hay alerta activa
🟡 Amarillo  = Advertencia — Riesgo moderado
🟠 Naranja   = Importante — Riesgo importante
🔴 Rojo      = Riesgo Extremo — Máximo riesgo
```

### 🏢 Tipos de Sede Disponibles

- **SSCC** — Centro de Salud/Servicios Centrales
- **Delegación** — Oficina Territorial
- **Clínica Dental** — Servicio Dental
- **Centro Médico** — Instalación Médica General
- **Datacenter** — Centro de Procesamiento de Datos

### 📋 Cómo Usar los Filtros

#### Filtro de Tipología (en el Sidebar):
- ✅ Afecta al **mapa** (solo se muestran marcadores de tipos seleccionados)
- ✅ Afecta a la **tabla** (solo se muestran alertas de tipos seleccionados)
- ✅ Afecta a **estadísticas** (recuentos solo de tipos seleccionados)

**Ejemplo**: Si desactivas "Delegación", desaparecen todas las delegaciones del mapa y la tabla

#### Filtro de Fenómenos (en la Tabla):
- ✅ Afecta **solo a la tabla** (no al mapa)
- ✅ **Se muestran por defecto** (todos los fenómenos activos)
- ❌ NO oculta sedes del mapa

**Ejemplo**: Desactivar "Viento" filtra la tabla para ocultar solo las alertas por viento, pero las sedes siguen visibles en el mapa

#### Rango Temporal (Selector Radio):
- **Alertas Actuales**: Muestra solo alertas que ya han comenzado
- **Próximas 24h**: Muestra alertas que comenzarán en las próximas 24 horas
- **Próximas 48h**: Muestra alertas que comenzarán en las próximas 48 horas
- ✅ Afecta tanto al **mapa como a la tabla** (cambian los colores según el rango)
- ✅ En el mapa: sedes sin alerta en ese rango aparecen en **VERDE**
- ✅ En la tabla: solo aparecen sedes con alertas activas (rojo/naranja/amarillo) en ese rango

**Ejemplo**: Si seleccionas "Próximas 24h", verás alertas que eventualmente afectarán a las sedes, mientras que "Alertas Actuales" solo muestra las que ya están en vigor

#### Estadísticas:
- Muestra recuento total de sedes según filtros de tipología
- Indica alertas activas (Rojo, Naranja, Amarillo) en el rango temporal seleccionado
- Se actualiza en tiempo real

---

## 🚀 Guía de Instalación Completa

### Requisitos Previos

#### Software necesario:
- **Docker** y **Docker Compose** (recomendado)
- Alternativamente: **Node.js 18+** (para ejecución sin Docker)
- **Git** para clonar el repositorio
- Acceso a internet para conectar con la API de AEMET

#### Acceso a la API de AEMET:
- ✅ API Key de AEMET (gratuita - ver instrucciones abajo)

---

## 🔑 PASO 1: Obtener tu API Key de AEMET

### ¿Qué es la API Key?

La API Key es una clave gratuita que te permite acceder a los datos meteorológicos oficiales de la Agencia Estatal de Meteorología (AEMET).

### Pasos para obtener tu API Key:

#### 1️⃣ **Accede al portal de OpenData de AEMET**

Visita: [https://opendata.aemet.es/centrodedescargas/inicio](https://opendata.aemet.es/centrodedescargas/inicio)

#### 2️⃣ **Regístrate o Inicia Sesión**

- Si **no tienes cuenta**: Haz clic en "Regístrate" (arriba a la derecha)
  - Completa el formulario con:
    - Nombre y apellidos
    - Email válido
    - Contraseña segura
  - Acepta los términos y condiciones
  - Recibirás un email de confirmación
  - Haz clic en el enlace del email para activar tu cuenta

- Si **ya tienes cuenta**: Haz clic en "Iniciar sesión"
  - Introduce tu email y contraseña

#### 3️⃣ **Solicitar la API Key**

Una vez dentro de tu cuenta:

1. Ve a la sección **"Solicitar API Key"** en el menú superior
2. Lee y acepta las condiciones de uso
3. Haz clic en **"Obtener API Key"**
4. Tu API Key aparecerá en pantalla
5. **IMPORTANTE**: 
   - ⚠️ **Copia tu API Key y guárdala en un lugar seguro**
   - ⚠️ **NO la compartas públicamente**
   - La API Key tiene este formato: `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOi...` (muy larga)

#### 4️⃣ **Verificar tu API Key**

Puedes verificar que funciona haciendo una petición de prueba:
```bash
# Reemplaza TU_API_KEY con tu clave real
curl "https://opendata.aemet.es/opendata/api/valores/climatologicos/inventarioestaciones/todasestaciones?api_key=TU_API_KEY"
```

Si recibes un JSON con datos, ¡tu API Key funciona! ✅

### ℹ️ Información importante sobre la API:

- ✅ Es **completamente gratuita**
- ✅ No tiene límite de peticiones diarias (uso razonable)
- ✅ Puedes usarla para proyectos personales y comerciales
- ⚠️ AEMET se reserva el derecho de revocar claves con uso abusivo
- 📖 Documentación oficial: [https://opendata.aemet.es/dist/index.html](https://opendata.aemet.es/dist/index.html)

---

## 📦 PASO 2: Clonar el Repositorio
```bash
# En tu servidor/NAS Synology, conéctate por SSH
ssh tu_usuario@ip_del_nas

# Navega a la carpeta de Docker (o donde prefieras)
cd /volume1/docker

# Clona el repositorio desde GitHub
git clone https://github.com/TU_USUARIO/alertas-meteorologicas.git

# Entra en la carpeta del proyecto
cd alertas-meteorologicas

# Verifica que todos los archivos están presentes
ls -la
```

---

## ⚙️ PASO 3: Configurar Variables de Entorno

### Crear el archivo `.env`:
```bash
# Copia la plantilla de ejemplo
cp .env.example .env

# Edita el archivo .env
nano .env
```

### Contenido del archivo `.env`:
```env
# ========================================
# CONFIGURACIÓN DE ALERTAS METEOROLÓGICAS
# ========================================

# API Key de AEMET
# Obtener en: https://opendata.aemet.es/centrodedescargas/inicio
# IMPORTANTE: Reemplaza 'your_api_key_here' con tu API Key real
AEMET_API_KEY=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOi...TU_API_KEY_COMPLETA_AQUI

# Puerto en el que se ejecutará la aplicación
PORT=3100

# Entorno de ejecución (development o production)
NODE_ENV=production
```

**⚠️ IMPORTANTE**: 
- Reemplaza `your_api_key_here` con tu **API Key real de AEMET**
- Guarda el archivo (Ctrl+O, Enter, Ctrl+X en nano)
- **NUNCA subas este archivo a GitHub** (ya está en `.gitignore`)

### Verificar la configuración:
```bash
# Ver que el archivo .env existe y tiene contenido
cat .env

# NO debería mostrar "your_api_key_here" sino tu API Key real
```

---

## 🐳 PASO 4: Desplegar con Docker

### Opción A: Primera instalación
```bash
# Construir e iniciar el contenedor
sudo docker-compose up -d --build

# Ver logs en tiempo real (Ctrl+C para salir)
sudo docker logs -f alertas-meteorologicas
```

### Opción B: Actualización desde una versión anterior
```bash
# Detener el contenedor actual
sudo docker-compose down

# Reconstruir sin usar caché
sudo docker-compose build --no-cache

# Iniciar de nuevo
sudo docker-compose up -d

# Verificar logs
sudo docker logs -f alertas-meteorologicas
```

---

## ✅ PASO 5: Verificar que Funciona

### 1. Verificar logs del contenedor:
```bash
sudo docker logs alertas-meteorologicas
```

Deberías ver algo como:
```
╔════════════════════════════════════════════════════════╗
║   🌦️  SISTEMA DE ALERTAS METEOROLÓGICAS AEMET  🌦️   ║
╚════════════════════════════════════════════════════════╝
✅ Servidor iniciado en http://0.0.0.0:3100
📁 Directorio de trabajo: /app/src
🔑 API Key AEMET: ✅ Configurada
🌍 Entorno: production
═══════════════════════════════════════════════════════
📄 Leyendo CSV desde: /app/data/sedes.csv
✅ 12 sedes leídas del CSV
```

Si ves `🔑 API Key AEMET: ❌ NO configurada`, revisa tu archivo `.env`

### 2. Verificar el estado del servicio:
```bash
# Ver que el contenedor está corriendo
sudo docker ps | grep alertas

# Ver estado de configuración
curl http://localhost:3100/api/config/status
```

Debería devolver:
```json
{
  "apiKeyConfigured": true,
  "nodeEnv": "production",
  "port": 3100
}
```

### 3. Acceder a la aplicación web:

Abre tu navegador en:
```
http://IP_DE_TU_SERVIDOR:3100
```

Por ejemplo: `http://192.168.1.137:3100`

Deberías ver:
- ✅ El mapa de España
- ✅ 12 marcadores con colores (alertas reales de AEMET)
- ✅ Botones "🇪🇸 Centrar España" y "🏝️ Canarias"
- ✅ Leyenda con los niveles de alerta

### 4. Verificar que se obtienen datos reales de AEMET:
```bash
# Consultar el API endpoint
curl http://localhost:3100/api/sedes | jq
```

Deberías ver JSON con las sedes y sus alertas actuales.

---

## 🌐 PASO 6 (Opcional): Configurar nginx como Reverse Proxy

Si quieres acceder con un dominio personalizado (por ejemplo: `alertas.midominio.com`):

### Crear configuración de nginx:
```bash
sudo nano /etc/nginx/sites-available/alertas-meteorologicas
```

Contenido:
```nginx
server {
    listen 80;
    server_name alertas.midominio.com;  # Cambia esto por tu dominio

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Activar y recargar nginx:
```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/alertas-meteorologicas /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar nginx
sudo nginx -s reload
```

### Configurar HTTPS con Let's Encrypt (recomendado):
```bash
# Instalar certbot (si no lo tienes)
sudo apt install certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d alertas.midominio.com
```

---

## 📊 Gestión y Mantenimiento

### Comandos útiles:
```bash
# Ver logs en tiempo real
sudo docker logs -f alertas-meteorologicas

# Ver logs de las últimas 100 líneas
sudo docker logs --tail 100 alertas-meteorologicas

# Reiniciar el servicio
sudo docker-compose restart

# Detener el servicio
sudo docker-compose down

# Ver estadísticas de uso (CPU, memoria)
sudo docker stats alertas-meteorologicas

# Ver estado del contenedor
sudo docker ps -a | grep alertas
```

### Añadir nuevas sedes:

1. Edita `data/sedes.csv`:
```bash
nano data/sedes.csv
```

2. Añade una nueva línea con el formato:
```csv
nombre,tipologia,calle,codigo_postal,latitud,longitud,provincia,responsable_nombre,responsable_telefono,responsable_email
Mi Nueva Sede,SSCC,Calle Nueva 1,28001,40.4168,-3.7038,Madrid,Juan García,+34 91 234 5678,juan@ejemplo.com
```

3. Opciones de tipología: `SSCC`, `Delegación`, `Clínica Dental`, `Centro Médico`, `Datacenter`

4. Reinicia el contenedor:
```bash
sudo docker-compose restart
```

Nota importante sobre el CSV:
- El archivo `data/sedes.csv` debe incluir coordenadas válidas en las columnas `latitud` y `longitud`.
- Si una fila contiene valores no numéricos o inválidos en latitud/longitud, **esa sede será omitida al cargar los datos** (se registrará una advertencia en los logs del servidor).
- El campo `provincia` es el código AEMET (p.ej., 28 para Madrid)

### Actualizar el sistema:
```bash
cd /volume1/docker/alertas-meteorologicas

# Obtener últimos cambios de GitHub
git pull

# Reconstruir e iniciar
sudo docker-compose down
sudo docker-compose up -d --build
```

---

## 🔧 Troubleshooting (Solución de Problemas)

### ❌ Error: "API Key NO configurada"

**Causa**: No se ha creado el archivo `.env` o la API Key es incorrecta.

**Solución**:
```bash
# Verificar que existe el archivo .env
ls -la .env

# Ver su contenido
cat .env

# Asegurarse de que tiene tu API Key real
nano .env
```

### ❌ No se muestran alertas / Todas las sedes en verde

**Posibles causas**:

1. **La API Key es incorrecta**
```bash
   # Verifica tu API Key manualmente
   curl "https://opendata.aemet.es/opendata/api/valores/climatologicos/inventarioestaciones/todasestaciones?api_key=TU_API_KEY"
```

2. **No hay alertas activas en este momento**
   - AEMET solo emite alertas cuando hay fenómenos meteorológicos adversos
   - Es normal ver todo en verde si no hay alertas

3. **Problemas de conectividad**
```bash
   # Verificar que el contenedor tiene acceso a internet
   sudo docker exec alertas-meteorologicas ping -c 3 opendata.aemet.es
```

4. **Ver logs para más detalles**
```bash
   sudo docker logs alertas-meteorologicas | grep -i error
```

### 🔁 Descargas AEMET (downloader) — Funcionamiento Automático

El sistema está configurado para ejecutar **automáticamente** el downloader:

- **Al iniciar**: Se ejecuta inmediatamente
- **Cada hora**: Se ejecuta el script Python según scheduler en `src/server.js`

Esto significa que **no necesitas hacer nada manualmente** — los datos se actualizan automáticamente.

#### Ver logs del downloader:
```bash
# Si usas Docker
sudo docker logs alertas-meteorologicas | grep -i downloader

# O en tiempo real
sudo docker logs -f alertas-meteorologicas
```

#### Ejecutar manualmente para probar (sin Docker):
```bash
# Instala dependencias
pip install -r src/downloader/requirements.txt

# Ejecuta el script
python3 src/downloader/alert_downloader.py
```

#### Estructura de datos generados:

```
data/
├── sedes.csv                                    # Base de datos de sedes
├── alertas-20260205-1045.csv                    # Alertas procesadas (con inicio/fin)
├── alertas-20260205-0945.csv                    # Alertas anteriores (archivadas)
└── alertas/
    ├── aemet-response-20260205T104549Z.json     # Respuesta JSON de AEMET
    ├── cd04bd32Z_CAP_C_LEMM_20260205104851.tar  # Archivo CAP comprimido
    └── tmp/
        ├── Z_CAP_C_LEMM_20260205090106_AFAZ743103NENV2311.xml
        ├── Z_CAP_C_LEMM_20260205090414_AFAZ711501COCO2314.xml
        └── ... (más XMLs)
```

El servidor automáticamente:
1. Lee el CSV más reciente de `data/alertas-*.csv`
2. Extrae información de inicio y fin de cada alerta
3. Sirve los datos a través de `/api/sedes`
4. La UI los consume y los visualiza

**No necesitas hacer commit** de los CSVs generados (están en `.gitignore`).

### 🔁 Descargas AEMET (downloader) — Solución de Problemas (Anterior)

El componente que obtiene los datos de AEMET se ejecuta en el servicio `aemet-downloader` del `docker-compose.yml`. Comprueba lo siguiente:

- **.env / AEMET_API_KEY**: Asegúrate de que `.env` contiene `AEMET_API_KEY=tu_clave` y que `docker-compose` carga ese fichero.

- **Ver logs del downloader**:
```bash
# Mostrar logs del contenedor downloader
sudo docker logs -f alertas-downloader
```

- **Ejecutar localmente para probar** (sin Docker):
```bash
# Instala deps y ejecuta
pip install -r src/downloader/requirements.txt
python3 src/downloader/alert_downloader.py
```

- **¿Por qué puede omitir la descarga?**
   - Si ya existe en `data/alertas` un fichero reciente (JSON o paquete) el script omite la descarga por diseño. Revisa qué archivos hay y su fecha de modificación:
```bash
ls -l data/alertas
```

- **Forzar una ejecución única en el contenedor**:
```bash
# Ejecutar manualmente dentro del contenedor (si ya está en marcha)
sudo docker exec -it alertas-downloader /bin/sh -c "python /app/src/downloader/alert_downloader.py"
```

Si tras estas comprobaciones sigue sin descargar, copia aquí los mensajes de log del downloader y los contenidos relevantes de `.env` (sin la clave completa si quieres mantenerla privada) y te ayudo a interpretar los errores.

### ❌ No se actualizan los datos automáticamente

**Verificar que el scheduler está activo**:
```bash
# Ver logs para confirmar que el scheduler se ejecutó
sudo docker logs alertas-meteorologicas | grep -i scheduler

# Deberías ver algo como:
# ✅ Scheduler de sincronización activado - Próxima descarga en 1 hora
```

**Forzar una descarga manual**:
```bash
# Ejecutar el downloader directamente
sudo docker exec alertas-meteorologicas python3 /app/src/downloader/alert_downloader.py
```

### ❌ El contenedor no inicia
```bash
# Ver por qué falló
sudo docker logs alertas-meteorologicas

# Verificar que no hay otro servicio en el puerto 3100
sudo netstat -tlnp | grep 3100

# Reconstruir desde cero
sudo docker-compose down -v
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### ❌ Error de permisos
```bash
# Dar permisos correctos a la carpeta
sudo chmod -R 755 /volume1/docker/alertas-meteorologicas
sudo chown -R tu_usuario:users /volume1/docker/alertas-meteorologicas
```

### ❌ "Error al obtener datos" en las alertas

**Causa**: La API de AEMET está temporalmente no disponible o hay un problema de red.

**Solución**: 
- El sistema está diseñado para manejar esto mostrando verde
- Espera unos minutos y recarga la página
- Verifica conectividad a internet

---

## 📱 API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Interfaz web principal |
| `/api/sedes` | GET | Listado de todas las sedes con alertas actuales |
| `/health` | GET | Health check del servicio |
| `/api/sincronizacion/estado` | GET | Estado de la última sincronización AEMET |

### Ejemplo de respuesta de `/api/sedes`:
```json
[
  {
    "nombre": "Sede Madrid Centro",
    "tipologia": "SSCC",
    "calle": "Calle Gran Vía 28",
    "codigoPostal": "28013",
    "latitud": 40.42,
    "longitud": -3.7038,
    "provincia": "Madrid",
    "responsable": {
      "nombre": "Dr. Carlos García Martínez",
      "telefono": "+34 91 234 5678",
      "email": "carlos.garcia@ejemplo.com"
    },
    "alerta": {
      "nombre": "Tormenta",
      "nivel": "naranja",
      "nombre_nivel": "Importante",
      "fenomeno": "Tormentas eléctricas",
      "start": "2026-02-05T14:00:00.000Z",
      "end": "2026-02-05T20:00:00.000Z",
      "timestamp": "2026-02-05T10:45:00.000Z"
    }
  }
]
```

Nota: Los campos `start` (inicio de alerta) y `end` (fin de alerta) se utilizan para el filtrado de rango temporal.

### Ejemplo de respuesta de `/api/sincronizacion/estado`:
```json
{
  "estado": "ok",
  "ultimaSincronizacion": "2026-02-05T11:00:00.000Z",
  "mensaje": "Última sincronización detectada"
}
```

---

## 📁 Estructura del Proyecto
```
alertas-meteorologicas/
├── data/
│   └── sedes.csv              # Base de datos de sedes
├── public/
│   ├── index.html             # Interfaz web
│   ├── css/
│   │   └── styles.css         # Estilos CSS
│   └── js/
│       └── map.js             # Lógica del mapa (Leaflet)
├── src/
│   ├── server.js              # Servidor Express
│   └── aemet-service.js       # Servicio de API AEMET
├── .env                       # Variables de entorno (NO subir a git)
├── .env.example               # Plantilla de variables de entorno
├── .gitignore                 # Archivos ignorados por git
├── Dockerfile                 # Imagen Docker
├── docker-compose.yml         # Orquestación Docker
├── package.json               # Dependencias Node.js
└── README.md                  # Esta documentación
```

---

## 🔐 Seguridad

### ⚠️ Buenas prácticas:

- ✅ **NUNCA** subas el archivo `.env` a GitHub
- ✅ Mantén tu API Key **privada** y **segura**
- ✅ Usa **HTTPS** en producción (con Let's Encrypt)
- ✅ Configura un **firewall** para limitar acceso al puerto 3100
- ✅ Cambia el puerto por defecto si es necesario
- ✅ Haz **backups regulares** de tu configuración

### Cambiar el puerto (si 3100 está ocupado):
```bash
# Editar .env
nano .env

# Cambiar PORT=3100 por el puerto que prefieras
PORT=8080

# Editar docker-compose.yml
nano docker-compose.yml

# Cambiar "3100:3100" por "8080:3100"

# Reiniciar
sudo docker-compose down
sudo docker-compose up -d
```

---

## 🤝 Contribuir

¿Quieres mejorar el proyecto?

1. **Fork** del repositorio
2. Crea una **rama** para tu feature: 
```bash
   git checkout -b feature/nueva-funcionalidad
```
3. **Commit** tus cambios: 
```bash
   git commit -m 'Añadir nueva funcionalidad'
```
4. **Push** a la rama: 
```bash
   git push origin feature/nueva-funcionalidad
```
5. Abre un **Pull Request**

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Puedes usarlo libremente en proyectos personales y comerciales.

---

## 🆘 Soporte y Ayuda

### ¿Necesitas ayuda?

1. **Revisa** la sección de [Troubleshooting](#-troubleshooting-solución-de-problemas)
2. **Consulta** los logs: `sudo docker logs alertas-meteorologicas`
3. **Abre un issue** en GitHub con:
   - Descripción del problema
   - Logs relevantes
   - Pasos para reproducir el error

### Recursos útiles:

- 📖 [Documentación oficial de AEMET OpenData](https://opendata.aemet.es/dist/index.html)
- 🗺️ [Documentación de Leaflet](https://leafletjs.com/reference.html)
- 🐳 [Documentación de Docker](https://docs.docker.com/)
- 📦 [Node.js Documentation](https://nodejs.org/docs/)

---

## 🎯 Roadmap (Futuras Mejoras)

- [ ] Panel de administración web para gestionar sedes
- [ ] Notificaciones por email/SMS cuando cambia el nivel de alerta
- [ ] Histórico de alertas con gráficos
- [ ] Exportación de datos a CSV/PDF
- [ ] Sistema de usuarios y autenticación
- [ ] API REST pública documentada
- [ ] Soporte para más fuentes de datos meteorológicos
- [ ] Aplicación móvil (iOS/Android)
- [ ] Webhooks para integración con otros sistemas
- [ ] Dashboard con estadísticas avanzadas
- [ ] Caché mejorado para optimizar rendimiento

---

## 📊 Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **Frontend**: HTML5 + CSS3 + JavaScript
- **Mapas**: Leaflet.js
- **API**: AEMET OpenData API
- **Containerización**: Docker + Docker Compose
- **Servidor Web**: nginx (opcional)

---

## ❤️ Agradecimientos

- **AEMET** por proporcionar datos meteorológicos abiertos y gratuitos
- **OpenStreetMap** por los mapas
- **Leaflet** por la librería de mapas

---

**Desarrollado con ❤️ para la monitorización meteorológica en España**

*Última actualización: Febrero 2026*
