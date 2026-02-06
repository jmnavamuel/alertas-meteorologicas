#!/bin/bash

# Script para cambiar entre modo dummy y real en config.ini

set -e

CONFIG_FILE="config.ini"
EXAMPLE_FILE="config.example.ini"

# Verificar que exista config.ini
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: $CONFIG_FILE no encontrado"
    echo "📋 Creando $CONFIG_FILE desde $EXAMPLE_FILE..."
    cp "$EXAMPLE_FILE" "$CONFIG_FILE"
fi

# Leer parámetro
MODE="${1:-help}"

case "$MODE" in
    dummy)
        sed -i '' 's/^mode=.*/mode=dummy/' "$CONFIG_FILE"
        echo "🔷 Modo cambiado a: DUMMY"
        echo "   Usando: data/alertas_dummy.csv"
        ;;
    real)
        sed -i '' 's/^mode=.*/mode=real/' "$CONFIG_FILE"
        echo "🔴 Modo cambiado a: REAL"
        echo "   Usando: último CSV de AEMET (alertas-YYYYMMDD-HHMM.csv)"
        ;;
    status)
        CURRENT_MODE=$(grep "^mode=" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' ')
        echo "📌 Modo actual: $CURRENT_MODE"
        ;;
    *)
        echo "📖 Uso: $0 [dummy|real|status]"
        echo ""
        echo "Ejemplos:"
        echo "  $0 dummy    # Cambiar a modo de prueba (dummy data)"
        echo "  $0 real     # Cambiar a modo real (AEMET)"
        echo "  $0 status   # Ver modo actual"
        echo ""
        echo "📄 Archivo de configuración: $CONFIG_FILE"
        ;;
esac
