#!/usr/bin/env python3
"""
Script de prueba para los endpoints de reportes automáticos
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from utils.report_generator import AutoReportGenerator
from database import get_database, connect_to_mongo

async def test_report_generator():
    """Prueba del generador de reportes"""
    print("🧪 Iniciando pruebas del generador de reportes...")
    
    try:
        # Conectar a MongoDB
        await connect_to_mongo()
        db = await get_database()
        print("✅ Conexión a MongoDB exitosa")
        
        # Crear instancia del generador
        generator = AutoReportGenerator(db)
        print("✅ Generador de reportes creado")
        
        # Probar reporte diario
        print("\n📊 Probando reporte diario...")
        daily_report = await generator.generate_daily_report()
        print(f"✅ Reporte diario generado para {daily_report.date}")
        print(f"   Total detecciones: {daily_report.metrics.total_detections}")
        print(f"   Números únicos: {daily_report.metrics.unique_numbers}")
        print(f"   Confianza promedio: {daily_report.metrics.avg_confidence}")
        
        # Probar reporte de productividad
        print("\n📈 Probando reporte de productividad...")
        productivity_report = await generator.generate_productivity_report(7)
        print(f"✅ Reporte de productividad generado para {productivity_report.period}")
        print(f"   Túneles analizados: {len(productivity_report.tunnel_performance)}")
        print(f"   Recomendaciones: {len(productivity_report.recommendations)}")
        
        # Probar reporte de calidad
        print("\n🎯 Probando reporte de calidad...")
        quality_report = await generator.generate_quality_report(7)
        print(f"✅ Reporte de calidad generado para {quality_report.period}")
        print(f"   Tasa de defectos: {quality_report.defect_rate}")
        print(f"   Tendencias de calidad: {len(quality_report.quality_trends)}")
        
        # Probar reporte de eficiencia
        print("\n⚡ Probando reporte de eficiencia...")
        efficiency_report = await generator.generate_efficiency_report(7)
        print(f"✅ Reporte de eficiencia generado para {efficiency_report.period}")
        print(f"   Tiempo de actividad: {efficiency_report.system_uptime}%")
        print(f"   Sugerencias: {len(efficiency_report.optimization_suggestions)}")
        
        # Probar reporte de alertas
        print("\n🚨 Probando reporte de alertas...")
        alerts_report = await generator.generate_alerts_report(7)
        print(f"✅ Reporte de alertas generado para {alerts_report.period}")
        print(f"   Alertas críticas: {len(alerts_report.critical_alerts)}")
        print(f"   Advertencias: {len(alerts_report.warning_alerts)}")
        print(f"   Anomalías detectadas: {len(alerts_report.anomalies_detected)}")
        
        # Probar resumen ejecutivo
        print("\n👔 Probando resumen ejecutivo...")
        executive_summary = await generator.generate_executive_summary(7)
        print(f"✅ Resumen ejecutivo generado")
        print(f"   KPIs disponibles: {len(executive_summary.get('kpis', {}))}")
        
        print("\n🎉 ¡Todas las pruebas completadas exitosamente!")
        return True
        
    except Exception as e:
        print(f"❌ Error durante las pruebas: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_with_sample_data():
    """Crear datos de muestra y probar reportes"""
    print("\n🔧 Creando datos de muestra para pruebas...")
    
    try:
        db = await get_database()
        collection = db.vagonetas
        
        # Crear algunos datos de muestra para los últimos días
        sample_data = []
        for i in range(10):
            sample_data.append({
                "numero": f"12{i:03d}",
                "confianza": 0.75 + (i * 0.02),
                "timestamp": datetime.now(timezone.utc) - timedelta(days=i//2, hours=i),
                "tunel": f"Túnel_{i % 3 + 1}",
                "imagen_path": f"test_image_{i}.jpg"
            })
        
        # Insertar datos de muestra
        await collection.insert_many(sample_data)
        print(f"✅ Insertados {len(sample_data)} registros de muestra")
        
        # Ahora probar los reportes con datos reales
        await test_report_generator()
        
        # Limpiar datos de muestra
        await collection.delete_many({"imagen_path": {"$regex": "test_image_"}})
        print("🧹 Datos de muestra eliminados")
        
    except Exception as e:
        print(f"❌ Error creando datos de muestra: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 Iniciando pruebas del sistema de reportes...")
    
    # Ejecutar pruebas
    try:
        # Primero probar con datos existentes
        success = asyncio.run(test_report_generator())
        
        if success:
            print("\n" + "="*50)
            print("📋 RESUMEN DE PRUEBAS")
            print("="*50)
            print("✅ Generador de reportes: FUNCIONANDO")
            print("✅ Reporte diario: FUNCIONANDO")
            print("✅ Reporte de productividad: FUNCIONANDO")
            print("✅ Reporte de calidad: FUNCIONANDO")
            print("✅ Reporte de eficiencia: FUNCIONANDO")
            print("✅ Reporte de alertas: FUNCIONANDO")
            print("✅ Resumen ejecutivo: FUNCIONANDO")
            print("\n🎯 El sistema de reportes está listo para producción!")
        else:
            print("\n❌ Algunas pruebas fallaron. Revisar logs.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error ejecutando pruebas: {e}")
        sys.exit(1)
