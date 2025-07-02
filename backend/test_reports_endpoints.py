#!/usr/bin/env python3
"""
Script para probar los endpoints de reportes mediante HTTP
"""

import requests
import json
from datetime import datetime, timedelta

def test_reports_endpoints():
    """Probar todos los endpoints de reportes"""
    base_url = "http://localhost:8000"
    
    print("🌐 Probando endpoints de reportes...")
    
    endpoints = [
        {
            "name": "Lista de reportes",
            "url": f"{base_url}/reports/list",
            "method": "GET"
        },
        {
            "name": "Reporte diario",
            "url": f"{base_url}/reports/daily",
            "method": "GET"
        },
        {
            "name": "Reporte de productividad",
            "url": f"{base_url}/reports/productivity?days_back=7",
            "method": "GET"
        },
        {
            "name": "Reporte de calidad",
            "url": f"{base_url}/reports/quality?days_back=7",
            "method": "GET"
        },
        {
            "name": "Reporte de eficiencia",
            "url": f"{base_url}/reports/efficiency?days_back=7",
            "method": "GET"
        },
        {
            "name": "Reporte de alertas",
            "url": f"{base_url}/reports/alerts?days_back=7",
            "method": "GET"
        },
        {
            "name": "Resumen ejecutivo",
            "url": f"{base_url}/reports/executive?days_back=7",
            "method": "GET"
        }
    ]
    
    results = []
    
    for endpoint in endpoints:
        try:
            print(f"\n📊 Probando: {endpoint['name']}")
            print(f"   URL: {endpoint['url']}")
            
            response = requests.get(endpoint['url'], timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Status: {response.status_code}")
                print(f"   📄 Respuesta: {data.get('status', 'N/A')}")
                if 'data' in data:
                    print(f"   📈 Datos: Disponibles")
                results.append({"endpoint": endpoint['name'], "status": "SUCCESS", "code": response.status_code})
            else:
                print(f"   ❌ Status: {response.status_code}")
                print(f"   📄 Error: {response.text}")
                results.append({"endpoint": endpoint['name'], "status": "ERROR", "code": response.status_code})
                
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Error: No se puede conectar al servidor")
            print(f"   💡 Asegúrate de que el servidor esté ejecutándose en {base_url}")
            results.append({"endpoint": endpoint['name'], "status": "CONNECTION_ERROR", "code": None})
        except Exception as e:
            print(f"   ❌ Error: {e}")
            results.append({"endpoint": endpoint['name'], "status": "EXCEPTION", "code": None})
    
    # Resumen
    print("\n" + "="*60)
    print("📋 RESUMEN DE PRUEBAS DE ENDPOINTS")
    print("="*60)
    
    success_count = sum(1 for r in results if r['status'] == 'SUCCESS')
    total_count = len(results)
    
    for result in results:
        status_icon = "✅" if result['status'] == 'SUCCESS' else "❌"
        print(f"{status_icon} {result['endpoint']}: {result['status']}")
    
    print(f"\n📊 Resultados: {success_count}/{total_count} endpoints funcionando")
    
    if success_count == total_count:
        print("🎉 ¡Todos los endpoints de reportes están funcionando!")
        return True
    else:
        print("⚠️ Algunos endpoints necesitan revisión")
        return False

def test_specific_date_report():
    """Probar reporte con fecha específica"""
    base_url = "http://localhost:8000"
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    print(f"\n📅 Probando reporte diario para fecha específica: {yesterday}")
    
    try:
        url = f"{base_url}/reports/daily?date={yesterday}"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Reporte para {yesterday} generado exitosamente")
            if 'data' in data and 'metrics' in data['data']:
                metrics = data['data']['metrics']
                print(f"   📊 Total detecciones: {metrics.get('total_detections', 0)}")
                print(f"   🔢 Números únicos: {metrics.get('unique_numbers', 0)}")
                print(f"   🎯 Confianza promedio: {metrics.get('avg_confidence', 0)}")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error probando fecha específica: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Iniciando pruebas de endpoints de reportes...")
    print("💡 Asegúrate de que el servidor FastAPI esté ejecutándose")
    
    # Probar endpoints básicos
    basic_success = test_reports_endpoints()
    
    # Probar funcionalidad específica
    date_success = test_specific_date_report()
    
    print("\n" + "="*60)
    print("🏁 RESULTADO FINAL")
    print("="*60)
    
    if basic_success and date_success:
        print("🎉 ¡Sistema de reportes completamente funcional!")
        print("📚 Documentación disponible en: http://localhost:8000/docs")
    else:
        print("⚠️ El sistema necesita algunas correcciones")
        print("🔧 Revisar logs del servidor para más detalles")
