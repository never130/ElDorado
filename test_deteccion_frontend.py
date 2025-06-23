#!/usr/bin/env python3
"""
Script para insertar una detección de prueba y verificar que aparezca en el frontend
"""

import sys
import os
import requests
import json
from datetime import datetime, timezone

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

try:
    from database import get_database
    from crud import create_vagoneta_record
    from schemas import VagonetaCreate
    print("✅ Módulos importados correctamente")
except Exception as e:
    print(f"❌ Error al importar módulos: {e}")
    sys.exit(1)

def crear_deteccion_prueba():
    """Crear una detección de prueba que simule el monitor en vivo"""
    try:
        # Crear registro de prueba similar al monitor en vivo
        timestamp_actual = datetime.now(timezone.utc)
        
        test_data = VagonetaCreate(
            numero="LIVE-TEST-123",
            confianza=0.85,
            imagen_path="test/live_test.jpg",
            modelo_ladrillo="Modelo_A",
            merma=5.2,
            tunel="Túnel Principal",
            evento="ingreso",
            origen_deteccion="live_camera",  # Importante: marcar como live_camera
            timestamp=timestamp_actual,
            metadata={
                "camera_id": "webcam",
                "fps": 15,
                "detection_type": "live_monitoring",
                "test": True
            }
        )
        
        # Insertar en base de datos
        record_id = create_vagoneta_record(test_data)
        print(f"✅ Detección de prueba creada con ID: {record_id}")
        print(f"📊 Número: LIVE-TEST-123")
        print(f"🎯 Confianza: 85%")
        print(f"📹 Origen: live_camera")
        print(f"🕒 Timestamp: {timestamp_actual}")
        
        return record_id, test_data
        
    except Exception as e:
        print(f"❌ Error al crear detección de prueba: {e}")
        return None, None

def verificar_en_historial(record_id):
    """Verificar que la detección aparezca en el endpoint del historial"""
    try:
        response = requests.get("http://localhost:8000/historial/?limit=5")
        
        if response.status_code == 200:
            data = response.json()
            registros = data.get('registros', [])
            
            # Buscar nuestro registro
            encontrado = False
            for registro in registros:
                if registro.get('numero_detectado') == 'LIVE-TEST-123':
                    encontrado = True
                    print(f"✅ Detección encontrada en el historial:")
                    print(f"   - ID: {registro.get('id')}")
                    print(f"   - Número: {registro.get('numero_detectado')}")
                    print(f"   - Origen: {registro.get('origen_deteccion')}")
                    print(f"   - Timestamp: {registro.get('timestamp')}")
                    break
            
            if not encontrado:
                print("⚠️ La detección no aparece en los primeros 5 registros del historial")
                print("   Pero esto es normal si hay muchas detecciones recientes")
            
            return encontrado
        else:
            print(f"❌ Error al consultar historial: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error al verificar historial: {e}")
        return False

def enviar_websocket_simulado():
    """Simular envío por WebSocket (esto normalmente lo hace el monitor)"""
    try:
        # El WebSocket se maneja automáticamente en el backend cuando se crea un registro
        # desde el monitor en vivo, pero podemos verificar la conexión
        print("ℹ️ El WebSocket debería notificar automáticamente la nueva detección")
        print("   Si el frontend está conectado, debería aparecer inmediatamente")
        return True
    except Exception as e:
        print(f"❌ Error con WebSocket: {e}")
        return False

def main():
    print("🧪 CREANDO DETECCIÓN DE PRUEBA PARA VERIFICAR FRONTEND")
    print("=" * 60)
    
    print("📋 Este script va a:")
    print("   1. Crear una detección simulada de 'live_camera'")
    print("   2. Verificar que aparezca en el historial")
    print("   3. Comprobar si se ve en el frontend")
    
    input("\nPresiona Enter para continuar...")
    
    # 1. Crear detección de prueba
    print("\n1. Creando detección de prueba...")
    record_id, test_data = crear_deteccion_prueba()
    
    if not record_id:
        return
    
    # 2. Verificar en historial
    print("\n2. Verificando en historial...")
    en_historial = verificar_en_historial(record_id)
    
    # 3. Verificar WebSocket
    print("\n3. Verificando WebSocket...")
    ws_ok = enviar_websocket_simulado()
    
    # Instrucciones para el usuario
    print("\n" + "=" * 60)
    print("🎯 INSTRUCCIONES PARA VERIFICAR EL FRONTEND:")
    print(f"")
    print(f"1. 🌐 Ve a tu navegador con el frontend (http://localhost:3000)")
    print(f"2. 📄 Ve a la página del 'Monitor en Tiempo Real'")
    print(f"3. 🔄 Actualiza la página (F5 o Ctrl+F5)")
    print(f"4. 👀 Busca esta detección:")
    print(f"   📊 Número: LIVE-TEST-123")
    print(f"   🎯 Confianza: 85%")
    print(f"   📹 Origen: En vivo")
    print(f"   🧱 Modelo: Modelo_A")
    print(f"")
    print(f"5. 🔍 Si NO aparece, verifica:")
    print(f"   - Presiona F12 y revisa la consola")
    print(f"   - Busca errores en rojo")
    print(f"   - Verifica que diga 'WebSocket conectado'")
    print(f"")
    print(f"6. 📋 También puedes ir al 'Historial' y buscar LIVE-TEST-123")
    
    print(f"\n🚀 ¿Aparece la detección LIVE-TEST-123 en el frontend?")
    print(f"   - SÍ: ✅ El sistema funciona, solo necesita tiempo o actualización")
    print(f"   - NO: ❌ Hay un problema de comunicación frontend-backend")

if __name__ == "__main__":
    main()
