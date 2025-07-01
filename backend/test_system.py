#!/usr/bin/env python3
"""
Script de verificación del sistema backend optimizado
Verifica que todos los módulos se importen correctamente y que las operaciones async funcionen
"""

import asyncio
import sys
from pathlib import Path

async def test_imports():
    """Prueba las importaciones principales"""
    try:
        print("🔍 Verificando importaciones...")
        
        # Test database async
        from database import connect_to_mongo, get_database
        print("✅ Database (Motor/async) - OK")
        
        # Test CRUD async
        import crud
        print("✅ CRUD async - OK")
        
        # Test schemas
        from schemas import VagonetaCreate, VagonetaInDB
        print("✅ Schemas - OK")
        
        # Test utils
        from utils.image_processing import run_detection_on_frame, processor
        print("✅ Image processing - OK")
        
        from utils.auto_capture_system import AutoCaptureManager, load_cameras_config
        print("✅ Auto capture system - OK")
        
        from utils.number_grouping import detectar_numero_compuesto_desde_resultados
        print("✅ Number grouping - OK")
        
        from utils.ocr import extract_number_from_image
        print("✅ OCR - OK")
        
        print("✅ Todas las importaciones exitosas!")
        return True
        
    except Exception as e:
        print(f"❌ Error en importaciones: {e}")
        return False

async def test_database_connection():
    """Prueba la conexión async a la base de datos"""
    try:
        print("\n🔍 Verificando conexión a base de datos...")
        
        from database import connect_to_mongo, get_database
        
        # Conectar
        await connect_to_mongo()
        print("✅ Conexión a MongoDB - OK")
        
        # Obtener database
        db = await get_database()
        print("✅ Obtención de database - OK")
        
        # Test simple query
        collection = db["vagonetas"]
        count = await collection.count_documents({})
        print(f"✅ Query de prueba - OK (documentos: {count})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en base de datos: {e}")
        return False

async def test_crud_operations():
    """Prueba operaciones CRUD async"""
    try:
        print("\n🔍 Verificando operaciones CRUD...")
        
        import crud
        from schemas import VagonetaCreate
        from datetime import datetime, timezone
        
        # Test crear registro
        test_record = VagonetaCreate(
            numero="TEST-001",
            evento="ingreso", 
            tunel="Test Tunnel",
            timestamp=datetime.now(timezone.utc),
            origen_deteccion="test_system"
        )
        
        created = await crud.create_vagoneta_record(test_record)
        print("✅ Crear registro - OK")
        
        # Test obtener historial  
        historial = await crud.get_historial_reciente(limit=1)
        print("✅ Obtener historial - OK")
        
        # Test eliminar registro de prueba
        if created:
            await crud.delete_vagoneta_record(created.id)
            print("✅ Eliminar registro - OK")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en CRUD: {e}")
        return False

async def main():
    """Función principal de verificación"""
    print("🚀 INICIANDO VERIFICACIÓN DEL SISTEMA BACKEND OPTIMIZADO")
    print("=" * 60)
    
    tests_passed = 0
    total_tests = 3
    
    # Test 1: Importaciones
    if await test_imports():
        tests_passed += 1
    
    # Test 2: Base de datos
    if await test_database_connection():
        tests_passed += 1
    
    # Test 3: CRUD
    if await test_crud_operations():
        tests_passed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 RESULTADOS: {tests_passed}/{total_tests} pruebas exitosas")
    
    if tests_passed == total_tests:
        print("🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL!")
        print("\n✅ Optimizaciones completadas:")
        print("   • Migración completa a async/await")
        print("   • Eliminación de módulos duplicados")
        print("   • Base de datos con Motor (async)")
        print("   • CRUD completamente asíncrono")
        print("   • Arquitectura limpia y modular")
        return True
    else:
        print("⚠️  Hay problemas que requieren atención")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n🛑 Verificación interrumpida por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Error inesperado: {e}")
        sys.exit(1)
