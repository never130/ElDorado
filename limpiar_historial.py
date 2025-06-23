#!/usr/bin/env python3
"""
Script para limpiar completamente el historial en MongoDB Atlas
ADVERTENCIA: Esto eliminará TODOS los registros de la colección vagonetas
"""

import sys
import os
from datetime import datetime

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

try:
    from database import get_database, get_vagonetas_collection
    print("✅ Módulos importados correctamente")
except Exception as e:
    print(f"❌ Error al importar módulos: {e}")
    sys.exit(1)

def limpiar_historial():
    """Eliminar todos los registros del historial"""
    try:
        # Obtener la colección
        collection = get_vagonetas_collection()
        
        # Contar registros antes de eliminar
        total_antes = collection.count_documents({})
        print(f"📊 Registros encontrados: {total_antes}")
        
        if total_antes == 0:
            print("✅ La colección ya está vacía")
            return
        
        # Confirmar eliminación
        print(f"\n⚠️ ADVERTENCIA: Vas a eliminar {total_antes} registros")
        print("Esta acción NO se puede deshacer")
        
        confirmacion = input("¿Estás seguro? Escribe 'ELIMINAR' para confirmar: ")
        
        if confirmacion != "ELIMINAR":
            print("❌ Operación cancelada")
            return
        
        # Eliminar todos los registros
        resultado = collection.delete_many({})
        
        print(f"✅ Historial limpiado exitosamente")
        print(f"📊 Registros eliminados: {resultado.deleted_count}")
        print(f"🗓️ Fecha de limpieza: {datetime.now()}")
        
        # Verificar que esté vacío
        total_despues = collection.count_documents({})
        print(f"📊 Registros restantes: {total_despues}")
        
        if total_despues == 0:
            print("✅ Limpieza completada correctamente")
        else:
            print("⚠️ Advertencia: Aún quedan algunos registros")
            
    except Exception as e:
        print(f"❌ Error al limpiar historial: {e}")

def main():
    print("🧹 LIMPIEZA DE HISTORIAL EN MONGODB ATLAS")
    print("=" * 50)
    
    print("⚠️ ADVERTENCIA IMPORTANTE:")
    print("Este script eliminará TODOS los registros del historial")
    print("Esta acción es irreversible")
    print("Solo afectará la base de datos de Atlas (no la local)")
    
    print("\nVerificando conexión...")
    
    try:
        db = get_database()
        print(f"✅ Conectado a base de datos: {db.name}")
        
        # Mostrar colecciones disponibles
        collections = db.list_collection_names()
        print(f"📂 Colecciones disponibles: {collections}")
        
        if 'vagonetas' not in collections:
            print("ℹ️ La colección 'vagonetas' no existe. No hay nada que limpiar.")
            return
        
        # Proceder con la limpieza
        limpiar_historial()
        
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    main()
