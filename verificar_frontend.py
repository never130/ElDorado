#!/usr/bin/env python3
"""
Script de verificación del frontend y comunicación WebSocket
Simula las peticiones que hace el frontend para diagnosticar problemas
"""

import requests
import json
import websockets
import asyncio
import time
from datetime import datetime

BACKEND_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/detections"

def verificar_endpoint_historial():
    """Verificar endpoint del historial que usa el frontend"""
    print("🔍 Verificando endpoint /historial/...")
    
    try:
        # Simular la petición exacta del frontend
        response = requests.get(f"{BACKEND_URL}/historial/?limit=10")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Endpoint funcionando correctamente")
            print(f"📊 Total de registros: {data.get('total', 0)}")
            print(f"📋 Registros retornados: {len(data.get('registros', []))}")
            
            # Analizar registros de live_camera
            registros = data.get('registros', [])
            live_camera_count = 0
            video_processing_count = 0
            
            print(f"\n🔍 Análisis de los primeros 10 registros:")
            for i, registro in enumerate(registros[:5]):
                origen = registro.get('origen_deteccion', 'N/A')
                numero = registro.get('numero_detectado', 'N/A')
                timestamp = registro.get('timestamp', 'N/A')
                confianza = registro.get('confianza', 0) * 100
                
                if origen == 'live_camera':
                    live_camera_count += 1
                elif origen == 'video_processing':
                    video_processing_count += 1
                
                print(f"  {i+1}. 📊 N°{numero} | 🎯 {confianza:.1f}% | 📹 {origen} | 🕒 {timestamp}")
            
            print(f"\n📈 Resumen (primeros 10):")
            print(f"  - live_camera: {live_camera_count} registros")
            print(f"  - video_processing: {video_processing_count} registros")
            print(f"  - otros: {len(registros) - live_camera_count - video_processing_count} registros")
            
            return True, data
        else:
            print(f"❌ Error en endpoint: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error al conectar con endpoint: {e}")
        return False, None

def verificar_endpoint_camaras():
    """Verificar endpoint de cámaras"""
    print("\n📹 Verificando endpoint /cameras/list...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/cameras/list")
        
        if response.status_code == 200:
            data = response.json()
            cameras = data.get('cameras', [])
            print(f"✅ Endpoint de cámaras funcionando")
            print(f"📸 Cámaras disponibles: {len(cameras)}")
            
            for camera in cameras:
                print(f"  - {camera.get('camera_id', 'N/A')}: {camera.get('tunel', 'Sin túnel')}")
                
            return True, data
        else:
            print(f"❌ Error en endpoint de cámaras: {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error al conectar con endpoint de cámaras: {e}")
        return False, None

async def verificar_websocket():
    """Verificar conexión WebSocket"""
    print("\n🔌 Verificando conexión WebSocket...")
    
    try:
        # Intentar conectar al WebSocket
        websocket = await websockets.connect(WS_URL)
        print("✅ WebSocket conectado exitosamente")
        
        # Enviar ping
        ping_message = json.dumps({"type": "ping", "timestamp": time.time()})
        await websocket.send(ping_message)
        print("📍 Ping enviado")
        
        # Esperar respuesta por unos segundos
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            print(f"🏓 Respuesta recibida: {response_data.get('type', 'unknown')}")
            
            if response_data.get('type') == 'pong':
                print("✅ WebSocket funcionando correctamente")
                websocket_ok = True
            else:
                print(f"⚠️ Respuesta inesperada: {response_data}")
                websocket_ok = True  # Aún funciona, solo respuesta diferente
                
        except asyncio.TimeoutError:
            print("⚠️ No se recibió respuesta del WebSocket (timeout)")
            websocket_ok = False
        
        await websocket.close()
        return websocket_ok
        
    except Exception as e:
        print(f"❌ Error de conexión WebSocket: {e}")
        return False

def verificar_endpoint_monitor():
    """Verificar endpoints del monitor"""
    print("\n🎥 Verificando endpoints del monitor...")
    
    # Primero verificar si hay cámaras
    try:
        cameras_response = requests.get(f"{BACKEND_URL}/cameras/list")
        if cameras_response.status_code != 200:
            print("❌ No se pueden obtener las cámaras")
            return False
            
        cameras = cameras_response.json().get('cameras', [])
        if not cameras:
            print("⚠️ No hay cámaras configuradas")
            return False
            
        camera_id = cameras[0].get('camera_id')
        print(f"📹 Probando con cámara: {camera_id}")
        
        # Verificar estado del monitor
        status_response = requests.get(f"{BACKEND_URL}/monitor/status/{camera_id}")
        if status_response.status_code == 200:
            status_data = status_response.json()
            print(f"✅ Estado del monitor: {status_data.get('status', 'unknown')}")
            return True
        else:
            print(f"⚠️ No se pudo obtener estado del monitor: {status_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error al verificar monitor: {e}")
        return False

def main():
    print("🔍 VERIFICACIÓN COMPLETA DE FRONTEND Y COMUNICACIÓN")
    print("=" * 60)
    
    # 1. Verificar endpoint del historial
    historial_ok, historial_data = verificar_endpoint_historial()
    
    # 2. Verificar endpoint de cámaras
    cameras_ok, cameras_data = verificar_endpoint_camaras()
    
    # 3. Verificar WebSocket
    websocket_ok = asyncio.run(verificar_websocket())
    
    # 4. Verificar endpoints del monitor
    monitor_ok = verificar_endpoint_monitor()
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📋 RESUMEN DE VERIFICACIÓN:")
    print(f"✅ Endpoint /historial/: {'OK' if historial_ok else 'ERROR'}")
    print(f"✅ Endpoint /cameras/list: {'OK' if cameras_ok else 'ERROR'}")
    print(f"✅ WebSocket conexión: {'OK' if websocket_ok else 'ERROR'}")
    print(f"✅ Endpoints monitor: {'OK' if monitor_ok else 'ERROR'}")
    
    if historial_ok and historial_data:
        registros = historial_data.get('registros', [])
        live_count = len([r for r in registros if r.get('origen_deteccion') == 'live_camera'])
        print(f"\n🎯 DETECCIONES ENCONTRADAS:")
        print(f"   - Total en BD: {historial_data.get('total', 0)}")
        print(f"   - Live camera (últimos 10): {live_count}")
        
        if live_count > 0:
            print(f"\n✅ DIAGNÓSTICO: El sistema está funcionando correctamente")
            print(f"   Las detecciones en vivo SÍ se están guardando y están disponibles")
            print(f"   Si no las ves en el frontend, el problema puede ser:")
            print(f"   1. 🔄 Frontend no está refrescando los datos")
            print(f"   2. 🔌 WebSocket desconectado durante la sesión")
            print(f"   3. 🎛️ Filtros activos en la interfaz")
            print(f"   4. 📦 Cache del navegador")
        else:
            print(f"\n⚠️ No se encontraron detecciones recientes de live_camera")
            print(f"   Es posible que no haya habido detecciones recientes")
    
    print(f"\n🚀 RECOMENDACIONES:")
    print(f"   1. Actualiza la página del frontend (F5)")
    print(f"   2. Verifica que el monitor esté activo")
    print(f"   3. Muestra números/ladrillos frente a la cámara")
    print(f"   4. Revisa la consola del navegador (F12)")

if __name__ == "__main__":
    main()
