FROM node:18-alpine

# Instalar dependencias del sistema necesarias para compilar paquetes
RUN apk add --no-cache wget ca-certificates python3 make g++

# Use host-mounted source directories (do not COPY app code/data into image)
WORKDIR /app

# Copiamos solo package.json para instalar dependencias en la imagen
COPY package*.json ./

# Instalar dependencias (no copiamos el código fuente para que en runtime se usen bind-mounts)
RUN npm cache clean --force && \
    npm install --legacy-peer-deps

# Nota: las carpetas `src`, `public` y `data` se esperan como bind-mounts desde el host

# 4. Exponemos el puerto
EXPOSE 3100

# 5. Comando de ejecución
CMD ["npm", "run", "dev"]