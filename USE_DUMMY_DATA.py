#!/usr/bin/env python3
"""
Script para cambiar entre datos reales y dummy para testing.

Uso:
    python3 USE_DUMMY_DATA.py dummy   # Usar datos dummy
    python3 USE_DUMMY_DATA.py real    # Usar datos reales
"""

import sys
import os
import shutil
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
ALERTS_CSV = os.path.join(DATA_DIR, 'alertas.csv')
REAL_CSV = os.path.join(DATA_DIR, 'alertas-latest-real.csv')
DUMMY_CSV = os.path.join(DATA_DIR, 'alertas_dummy.csv')

def switch_to_dummy():
    """Switch to using dummy data"""
    # Hacer backup del CSV real si existe
    for csv in os.listdir(DATA_DIR):
        if csv.startswith('alertas-') and csv.endswith('.csv'):
            backup_path = os.path.join(DATA_DIR, 'alertas-latest-real.csv')
            if not os.path.exists(backup_path):
                source_path = os.path.join(DATA_DIR, csv)
                shutil.copy2(source_path, backup_path)
                print(f"✅ Backup guardado: {backup_path}")
            break
    
    # Copiar dummy al lugar del CSV activo más reciente
    if os.path.exists(DUMMY_CSV):
        for csv in os.listdir(DATA_DIR):
            if csv.startswith('alertas-') and csv.endswith('.csv'):
                target = os.path.join(DATA_DIR, csv)
                shutil.copy2(DUMMY_CSV, target)
                print(f"✅ Usando datos DUMMY")
                print(f"   Datos copiados a: {target}")
                return
    else:
        print(f"❌ Error: {DUMMY_CSV} no encontrado")

def switch_to_real():
    """Switch to using real data"""
    if os.path.exists(REAL_CSV):
        for csv in os.listdir(DATA_DIR):
            if csv.startswith('alertas-') and csv.endswith('.csv'):
                target = os.path.join(DATA_DIR, csv)
                shutil.copy2(REAL_CSV, target)
                print(f"✅ Usando datos REALES")
                print(f"   Datos copiados desde: {REAL_CSV}")
                return
        print("❌ Error: No hay CSV de alertas-* para reemplazar")
    else:
        print("❌ Error: No hay backup de datos reales. Debes usar datos reales al menos una vez.")

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 USE_DUMMY_DATA.py [dummy|real]")
        print("")
        print("Ejemplos:")
        print("  python3 USE_DUMMY_DATA.py dummy   # Usar datos de prueba")
        print("  python3 USE_DUMMY_DATA.py real    # Usar datos reales de AEMET")
        sys.exit(1)
    
    mode = sys.argv[1].lower()
    
    if mode == 'dummy':
        switch_to_dummy()
    elif mode == 'real':
        switch_to_real()
    else:
        print(f"❌ Modo desconocido: {mode}")
        print("Use 'dummy' o 'real'")
        sys.exit(1)

if __name__ == '__main__':
    main()
