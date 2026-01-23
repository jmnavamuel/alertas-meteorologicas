# 🌦️ Sistema de Alertas Meteorológicas AEMET

Sistema de monitorización en tiempo real de alertas meteorológicas de AEMET para múltiples sedes distribuidas por España.

![Versión](https://img.shields.io/badge/versión-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![Licencia](https://img.shields.io/badge/licencia-MIT-orange)

## 📋 Características

- ✅ **API Real de AEMET**: Conexión directa con la API oficial de AEMET
- 🗺️ **Mapa Interactivo**: Visualización con Leaflet.js
- 🎨 **4 Niveles de Alerta**: Verde, Amarillo, Naranja y Rojo
- 🔄 **Actualización Automática**: Refresco cada 5 minutos
- 💾 **Sistema de Caché**: Optimización de llamadas a la API (10 minutos)
- 🐳 **Dockerizado**: Fácil despliegue con Docker Compose
- 📱 **Responsive**: Adaptado a móviles y tablets
- 🏝️ **Multi-región**: Soporte para Península y Canarias

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
nombre,calle,codigo_postal,latitud,longitud,provincia
Mi Nueva Sede,Calle Nueva 1,28001,40.4168,-3.7038,28
```

3. Reinicia el contenedor:
```bash
sudo docker-compose restart
```

Nota importante sobre el CSV:
- El archivo `data/sedes.csv` debe incluir coordenadas válidas en las columnas `latitud` y `longitud`.
- Si una fila contiene valores no numéricos o inválidos en latitud/longitud, **esa sede será omitida al cargar los datos** (se registrará una advertencia en los logs del servidor).
- El campo `provincia` es opcional —si no se proporciona, el servicio intentará inferirla a partir del código postal.

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
| `/api/config/status` | GET | Estado de la configuración |

### Ejemplo de respuesta de `/api/sedes`:
```json
[
  {
    "nombre": "Sede Madrid Centro",
    "calle": "Calle Gran Vía 28",
    "codigoPostal": "28013",
    "latitud": 40.42,
    "longitud": -3.7038,
    "provincia": "28",
    "alerta": {
      "color": "#28a745",
      "nivel": "verde",
      "nombre": "Sin riesgo",
      "fenomeno": null,
      "actualizacion": "2026-01-18T10:30:00.000Z"
    }
  }
]
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

- [ ] Panel de administración web
- [ ] Notificaciones por email/SMS cuando cambia el nivel de alerta
- [ ] Histórico de alertas con gráficos
- [ ] Exportación de datos a CSV/PDF
- [ ] Sistema de usuarios y autenticación
- [ ] API REST pública
- [ ] Soporte para más fuentes de datos meteorológicos
- [ ] Aplicación móvil (iOS/Android)
- [ ] Webhooks para integración con otros sistemas
- [ ] Dashboard con estadísticas avanzadas

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

*Última actualización: Enero 2026*
