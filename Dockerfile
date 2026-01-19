FROM node:18-alpine

# Instalar herramientas básicas
RUN apk add --no-cache wget ca-certificates

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm cache clean --force && \
    npm install --production --no-optional

# Copiar archivos del proyecto
COPY src/ ./src/
COPY public/ ./public/
COPY data/ ./data/

# Verificar estructura
RUN ls -la /app && \
    ls -la /app/src && \
    ls -la /app/public && \
    ls -la /app/data

EXPOSE 3100

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

# Ejecutar aplicación
CMD ["node", "src/server.js"]
