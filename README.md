```markdown
# Sistema de Alertas Meteorológicas AEMET

Aplicación web que muestra en tiempo real las alertas meteorológicas de AEMET para diferentes sedes distribuidas por España.

## 🚀 Características

- Mapa interactivo de España con Leaflet
- Visualización de sedes con código de colores según nivel de alerta
- Niveles de alerta: Verde, Amarillo, Naranja y Rojo
- Información detallada de cada sede
- Actualización automática cada 5 minutos
- Responsive design

## 📋 Requisitos

- Node.js 18+
- Docker y Docker Compose (para despliegue)

## 🛠️ Instalación Local

1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/alertas-meteorologicas.git
cd alertas-meteorologicas
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar servidor:
```bash
npm start
```

4. Abrir navegador en `http://localhost:3000`

## 🐳 Despliegue con Docker

1. Construir y ejecutar:
```bash
docker-compose up -d
```

2. Ver logs:
```bash
docker-compose logs -f
```

3. Detener:
```bash
docker-compose down
```

## 📁 Estructura de Datos

El archivo `data/sedes.csv` debe tener el siguiente formato:
```csv
nombre,calle,codigo_postal,latitud,longitud
Sede Ejemplo,Calle Principal 1,28001,40.4168,-3.7038
```

## 🔄 Próximos Pasos

- [ ] Integración con API real de AEMET
- [ ] Sistema de autenticación
- [ ] Panel de administración
- [ ] Notificaciones por email/SMS
- [ ] Histórico de alertas
- [ ] Exportación de datos

## 📝 Licencia

MIT
```

## Instrucciones de uso:

1. **Crear carpetas**: Crea la estructura de carpetas indicada
2. **Copiar archivos**: Copia cada código en su archivo correspondiente
3. **Instalar**: Ejecuta `npm install` en la raíz del proyecto
4. **Probar**: Ejecuta `npm start` y abre http://localhost:3000

¡El mockup estará funcionando con alertas simuladas!
