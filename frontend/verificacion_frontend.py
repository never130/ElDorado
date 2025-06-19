#!/usr/bin/env python3
"""
Script de verificación exhaustiva del frontend para sincronización con backend
Verifica endpoints, campos de datos, y funcionalidad completa
"""

import os
import json
import re
from pathlib import Path

def analyze_frontend():
    """Analiza el frontend para verificar sincronización con backend"""
    frontend_path = Path(__file__).parent
    
    print("🔍 VERIFICACIÓN EXHAUSTIVA DEL FRONTEND")
    print("=" * 50)
    
    # 1. Verificar estructura de archivos
    print("📁 Verificando estructura de archivos...")
    required_files = [
        "src/App.js",
        "src/components/RealTimeMonitorNew.js",
        "src/components/Upload.js",
        "src/components/Historial.js",
        "src/components/Trayectoria.js",
        "src/config/api.js",
        "package.json"
    ]
    
    missing_files = []
    for file in required_files:
        if not (frontend_path / file).exists():
            missing_files.append(file)
        else:
            print(f"✅ {file}")
    
    if missing_files:
        print(f"❌ Archivos faltantes: {missing_files}")
        return False
    
    # 2. Verificar endpoints en el frontend
    print("\n🌐 Verificando endpoints del frontend...")
    
    expected_endpoints = [
        '/historial/',
        '/cameras/list',
        '/monitor/start/',
        '/monitor/stop/',
        '/upload/',
        '/upload-multiple/',
        '/finalize-upload/',
        '/trayectoria/',
        '/ws/detections'
    ]
    
    js_files = list(frontend_path.glob("src/**/*.js"))
    
    endpoints_found = set()
    for js_file in js_files:
        try:
            content = js_file.read_text(encoding='utf-8')
            # Buscar patrones de endpoints
            patterns = [
                r'[\'"`]/[a-zA-Z0-9-_/]+/?[\'"`]',
                r'`[^`]*localhost:8000([^`]*)`',
                r'new WebSocket\([\'"`]([^\'"`]*)[\'"`]\)'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                for match in matches:
                    if isinstance(match, str) and ('/' in match or 'ws:' in match):
                        endpoints_found.add(match.strip('\'"` '))
        except Exception as e:
            print(f"⚠️ Error leyendo {js_file}: {e}")
    
    print(f"📊 Endpoints encontrados en frontend: {len(endpoints_found)}")
    for endpoint in sorted(endpoints_found):
        if any(exp in endpoint for exp in expected_endpoints):
            print(f"✅ {endpoint}")
        else:
            print(f"🔍 {endpoint}")
    
    # 3. Verificar campos de datos
    print("\n📊 Verificando campos de datos...")
    
    backend_fields = [
        'numero_detectado',
        'modelo_ladrillo', 
        'confianza',
        'timestamp',
        'evento',
        'tunel',
        'origen_deteccion',
        'imagen_path'
    ]
    
    fields_found = set()
    for js_file in js_files:
        try:
            content = js_file.read_text(encoding='utf-8')
            for field in backend_fields:
                if field in content:
                    fields_found.add(field)
        except Exception as e:
            print(f"⚠️ Error leyendo {js_file}: {e}")
    
    print("Campos del backend encontrados en frontend:")
    for field in backend_fields:
        if field in fields_found:
            print(f"✅ {field}")
        else:
            print(f"❌ {field} - NO ENCONTRADO")
    
    # 4. Verificar package.json
    print("\n📦 Verificando dependencias...")
    
    try:
        package_json = json.loads((frontend_path / "package.json").read_text())
        required_deps = ['react', 'axios', 'react-dom', 'react-scripts']
        
        deps = package_json.get('dependencies', {})
        for dep in required_deps:
            if dep in deps:
                print(f"✅ {dep}: {deps[dep]}")
            else:
                print(f"❌ {dep} - FALTANTE")
    except Exception as e:
        print(f"❌ Error leyendo package.json: {e}")
    
    # 5. Verificar configuración de API
    print("\n⚙️ Verificando configuración de API...")
    
    try:
        api_config_path = frontend_path / "src/config/api.js"
        if api_config_path.exists():
            content = api_config_path.read_text(encoding='utf-8')
            if "localhost:8000" in content or "127.0.0.1:8000" in content:
                print("✅ URL del backend configurada correctamente")
            else:
                print("❌ URL del backend no encontrada")
        else:
            print("❌ Archivo de configuración API no encontrado")
    except Exception as e:
        print(f"❌ Error verificando configuración API: {e}")
    
    # 6. Verificar uso de WebSocket
    print("\n🔌 Verificando implementación de WebSocket...")
    
    ws_found = False
    for js_file in js_files:
        try:
            content = js_file.read_text(encoding='utf-8')
            if 'WebSocket' in content and 'ws://localhost:8000' in content:
                ws_found = True
                print(f"✅ WebSocket implementado en {js_file.name}")
                break
        except Exception as e:
            print(f"⚠️ Error leyendo {js_file}: {e}")
    
    if not ws_found:
        print("❌ Implementación de WebSocket no encontrada")
    
    print("\n" + "=" * 50)
    print("📋 RESUMEN DE VERIFICACIÓN")
    print("=" * 50)
    
    issues = []
    
    if missing_files:
        issues.append(f"Archivos faltantes: {len(missing_files)}")
    
    missing_fields = set(backend_fields) - fields_found
    if missing_fields:
        issues.append(f"Campos no sincronizados: {list(missing_fields)}")
    
    if not ws_found:
        issues.append("WebSocket no implementado correctamente")
    
    if issues:
        print("❌ PROBLEMAS ENCONTRADOS:")
        for issue in issues:
            print(f"   • {issue}")
        print("\n🔧 REQUIERE CORRECCIONES")
        return False
    else:
        print("✅ FRONTEND COMPLETAMENTE SINCRONIZADO")
        print("🎉 Sin problemas detectados")
        return True

if __name__ == "__main__":
    analyze_frontend()
