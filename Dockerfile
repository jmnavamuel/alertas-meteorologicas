FROM node:18-alpine

# Instalar dependencias del sistema necesarias para compilar paquetes
RUN apk add --no-cache wget ca-certificates python3 make g++

WORKDIR /app

# 1. Copiamos solo los archivos de dependencias
COPY package*.json ./

# 2. LIMPIEZA Y DESCARGA: 
# Forzamos la limpieza de caché y usamos --legacy-peer-deps para evitar conflictos de red/versión
RUN npm cache clean --force && \
    npm install --legacy-peer-deps

# 3. Copiamos los archivos fuente (serán sobrescritos por volúmenes en dev)
COPY src/ ./src/
COPY public/ ./public/
COPY data/ ./data/

# 4. Exponemos el puerto
EXPOSE 3100

# 5. Comando de ejecución
CMD ["npm", "run", "dev"]