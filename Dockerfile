FROM node:18-alpine

# Instalar herramientas básicas
RUN apk add --no-cache wget ca-certificates

WORKDIR /app

# 1. Copiamos solo los archivos de dependencias para aprovechar la caché de capas de Docker
COPY package*.json ./

# 2. Instalamos TODAS las dependencias (quitamos --production para tener nodemon)
RUN npm install

# 3. Exponemos el puerto
EXPOSE 3100

# 4. El comando por defecto será el script de desarrollo con nodemon
CMD ["npm", "run", "dev"]