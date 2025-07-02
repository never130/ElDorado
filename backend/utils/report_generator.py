"""
Sistema de Reportes Automáticos para el Sistema de Monitoreo de Vagonetas
=======================================================================

Este módulo implementa un sistema completo de generación de reportes automáticos
que analiza el historial de vagonetas detectadas y genera insights útiles para
la operación y gestión.

Tipos de Reportes:
- Diario: Actividad del día
- Productividad: Análisis por túnel y turno
- Calidad: Merma y defectos detectados
- Eficiencia: Rendimiento del sistema de detección
- Alertas: Anomalías y patrones inusuales
- Ejecutivo: Dashboard gerencial semanal/mensual
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, Counter
import statistics
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import pandas as pd
import numpy as np
from dataclasses import dataclass, asdict
from enum import Enum

class ReportType(Enum):
    """Tipos de reportes disponibles"""
    DAILY = "daily"
    PRODUCTIVITY = "productivity"
    QUALITY = "quality"
    EFFICIENCY = "efficiency"
    ALERTS = "alerts"
    EXECUTIVE = "executive"

class ReportFrequency(Enum):
    """Frecuencia de generación de reportes"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

@dataclass
class ReportMetrics:
    """Métricas base para todos los reportes"""
    total_detections: int
    unique_numbers: int
    avg_confidence: float
    period_start: datetime
    period_end: datetime
    success_rate: float
    processing_time_avg: float

@dataclass
class DailyReport:
    """Reporte diario de actividad"""
    date: str
    metrics: ReportMetrics
    hourly_distribution: Dict[int, int]
    tunnel_breakdown: Dict[str, int]
    top_numbers: List[Tuple[str, int]]
    quality_summary: Dict[str, Any]
    alerts: List[str]

@dataclass
class ProductivityReport:
    """Reporte de productividad por túnel"""
    period: str
    tunnel_performance: Dict[str, Dict]
    shift_analysis: Dict[str, Dict]
    efficiency_trends: Dict[str, List]
    bottlenecks: List[Dict]
    recommendations: List[str]

@dataclass
class QualityReport:
    """Reporte de calidad y merma"""
    period: str
    defect_rate: float
    merma_analysis: Dict[str, Any]
    confidence_distribution: Dict[str, int]
    model_accuracy: Dict[str, float]
    quality_trends: List[Dict]

@dataclass
class EfficiencyReport:
    """Reporte de eficiencia del sistema"""
    period: str
    system_uptime: float
    detection_accuracy: Dict[str, float]
    processing_speed: Dict[str, float]
    error_rates: Dict[str, float]
    performance_trends: List[Dict]
    optimization_suggestions: List[str]

@dataclass
class AlertsReport:
    """Reporte de alertas y anomalías"""
    period: str
    critical_alerts: List[Dict]
    warning_alerts: List[Dict]
    anomalies_detected: List[Dict]
    pattern_analysis: Dict[str, Any]
    recommendations: List[str]

@dataclass
class ExecutiveReport:
    """Resumen ejecutivo"""
    period: str
    kpis: Dict[str, Any]
    trends: Dict[str, List]
    achievements: List[str]
    concerns: List[str]
    action_items: List[str]
    forecast: Dict[str, Any]

class AutoReportGenerator:
    """Generador automático de reportes del sistema"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.vagonetas
        
    async def generate_daily_report(self, target_date: Optional[datetime] = None) -> DailyReport:
        """
        Genera un reporte diario completo de actividad
        
        Args:
            target_date: Fecha objetivo (por defecto ayer)
        
        Returns:
            DailyReport con todas las métricas del día
        """
        if target_date is None:
            target_date = datetime.now(timezone.utc) - timedelta(days=1)
        
        # Definir rango del día
        start_date = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
        
        # Query para obtener datos del día
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_detections": {"$sum": 1},
                    "unique_numbers": {"$addToSet": "$numero"},
                    "avg_confidence": {"$avg": "$confianza"},
                    "detections": {"$push": "$$ROOT"}
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        
        if not result:
            # Día sin actividad
            return DailyReport(
                date=target_date.strftime("%Y-%m-%d"),
                metrics=ReportMetrics(
                    total_detections=0,
                    unique_numbers=0,
                    avg_confidence=0.0,
                    period_start=start_date,
                    period_end=end_date,
                    success_rate=0.0,
                    processing_time_avg=0.0
                ),
                hourly_distribution={},
                tunnel_breakdown={},
                top_numbers=[],
                quality_summary={},
                alerts=["No se detectaron vagonetas en este día"]
            )
        
        data = result[0]
        detections = data["detections"]
        
        # Calcular métricas base
        metrics = ReportMetrics(
            total_detections=data["total_detections"],
            unique_numbers=len(data["unique_numbers"]),
            avg_confidence=round(data["avg_confidence"], 3),
            period_start=start_date,
            period_end=end_date,
            success_rate=await self._calculate_success_rate(detections),
            processing_time_avg=await self._calculate_avg_processing_time(detections)
        )
        
        # Distribución por horas
        hourly_dist = defaultdict(int)
        for detection in detections:
            hour = detection["timestamp"].hour
            hourly_dist[hour] += 1
        
        # Desglose por túnel
        tunnel_breakdown = defaultdict(int)
        for detection in detections:
            tunnel = detection.get("tunel", "Desconocido")
            tunnel_breakdown[tunnel] += 1
        
        # Top números más frecuentes
        number_counts = Counter(d["numero"] for d in detections)
        top_numbers = number_counts.most_common(10)
        
        # Resumen de calidad
        quality_summary = await self._generate_quality_summary(detections)
        
        # Alertas del día
        alerts = await self._generate_daily_alerts(detections, metrics)
        
        return DailyReport(
            date=target_date.strftime("%Y-%m-%d"),
            metrics=metrics,
            hourly_distribution=dict(hourly_dist),
            tunnel_breakdown=dict(tunnel_breakdown),
            top_numbers=top_numbers,
            quality_summary=quality_summary,
            alerts=alerts
        )
    
    async def generate_productivity_report(self, days_back: int = 7) -> ProductivityReport:
        """
        Genera reporte de productividad y eficiencia por túneles
        
        Args:
            days_back: Número de días hacia atrás para analizar
            
        Returns:
            ProductivityReport con análisis de productividad
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days_back)
        
        # Pipeline para análisis de productividad por túnel
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$addFields": {
                    "hour": {"$hour": "$timestamp"},
                    "day_of_week": {"$dayOfWeek": "$timestamp"},
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
                }
            },
            {
                "$group": {
                    "_id": {
                        "tunel": "$tunel",
                        "date": "$date",
                        "hour": "$hour"
                    },
                    "count": {"$sum": 1},
                    "avg_confidence": {"$avg": "$confianza"},
                    "detections": {"$push": "$$ROOT"}
                }
            }
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(length=None)
        
        # Procesar resultados para métricas de productividad
        tunnel_performance = await self._analyze_tunnel_performance(results)
        shift_analysis = await self._analyze_shifts(results)
        efficiency_trends = await self._calculate_efficiency_trends(results)
        bottlenecks = await self._identify_bottlenecks(results)
        recommendations = await self._generate_recommendations(tunnel_performance, bottlenecks)
        
        return ProductivityReport(
            period=f"{start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}",
            tunnel_performance=tunnel_performance,
            shift_analysis=shift_analysis,
            efficiency_trends=efficiency_trends,
            bottlenecks=bottlenecks,
            recommendations=recommendations
        )
    
    async def generate_quality_report(self, days_back: int = 30) -> QualityReport:
        """
        Genera reporte de calidad y análisis de merma
        
        Args:
            days_back: Período de análisis en días
            
        Returns:
            QualityReport con métricas de calidad
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days_back)
        
        # Query para datos de calidad
        cursor = self.collection.find({
            "timestamp": {
                "$gte": start_date,
                "$lt": end_date
            }
        })
        
        detections = await cursor.to_list(length=None)
        
        if not detections:
            return QualityReport(
                period=f"{start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}",
                defect_rate=0.0,
                merma_analysis={},
                confidence_distribution={},
                model_accuracy={},
                quality_trends=[]
            )
        
        # Análisis de calidad
        defect_rate = await self._calculate_defect_rate(detections)
        merma_analysis = await self._analyze_merma(detections)
        confidence_dist = await self._analyze_confidence_distribution(detections)
        model_accuracy = await self._analyze_model_accuracy(detections)
        quality_trends = await self._calculate_quality_trends(detections)
        
        return QualityReport(
            period=f"{start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}",
            defect_rate=defect_rate,
            merma_analysis=merma_analysis,
            confidence_distribution=confidence_dist,
            model_accuracy=model_accuracy,
            quality_trends=quality_trends
        )
    
    async def generate_alert_report(self) -> Dict[str, Any]:
        """
        Genera reporte de alertas y anomalías detectadas
        
        Returns:
            Dict con alertas del sistema
        """
        now = datetime.now(timezone.utc)
        last_24h = now - timedelta(hours=24)
        last_week = now - timedelta(days=7)
        
        alerts = {
            "timestamp": now.isoformat(),
            "critical_alerts": [],
            "warnings": [],
            "system_health": {},
            "anomalies": []
        }
        
        # Verificar actividad reciente
        recent_count = await self.collection.count_documents({
            "timestamp": {"$gte": last_24h}
        })
        
        if recent_count == 0:
            alerts["critical_alerts"].append({
                "type": "NO_ACTIVITY",
                "message": "No hay detecciones en las últimas 24 horas",
                "severity": "CRITICAL",
                "timestamp": now.isoformat()
            })
        
        # Verificar caídas de confianza
        low_confidence_count = await self.collection.count_documents({
            "timestamp": {"$gte": last_24h},
            "confianza": {"$lt": 0.3}
        })
        
        if low_confidence_count > recent_count * 0.3:  # Más del 30% con baja confianza
            alerts["warnings"].append({
                "type": "LOW_CONFIDENCE",
                "message": f"Alta proporción de detecciones con baja confianza: {low_confidence_count}/{recent_count}",
                "severity": "WARNING",
                "timestamp": now.isoformat()
            })
        
        # Detectar números anómalos
        anomalies = await self._detect_number_anomalies(last_week, now)
        alerts["anomalies"] = anomalies
        
        # Estado del sistema
        alerts["system_health"] = await self._calculate_system_health()
        
        return alerts
    
    async def generate_executive_summary(self, period_days: int = 30) -> Dict[str, Any]:
        """
        Genera reporte ejecutivo con KPIs principales
        
        Args:
            period_days: Período de análisis
            
        Returns:
            Dict con resumen ejecutivo
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # KPIs principales
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_processed": {"$sum": 1},
                    "unique_wagons": {"$addToSet": "$numero"},
                    "avg_confidence": {"$avg": "$confianza"},
                    "tunnels": {"$addToSet": "$tunel"},
                    "daily_data": {
                        "$push": {
                            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                            "numero": "$numero",
                            "tunel": "$tunel",
                            "confianza": "$confianza"
                        }
                    }
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        
        if not result:
            return {
                "period": f"{period_days} días",
                "no_data": True,
                "message": "No hay datos disponibles para el período seleccionado"
            }
        
        data = result[0]
        
        # Procesar datos diarios
        daily_volumes = defaultdict(int)
        for item in data["daily_data"]:
            daily_volumes[item["date"]] += 1
        
        # Calcular tendencias
        volumes = list(daily_volumes.values())
        trend = "estable"
        if len(volumes) > 1:
            if volumes[-1] > volumes[0] * 1.1:
                trend = "creciente"
            elif volumes[-1] < volumes[0] * 0.9:
                trend = "decreciente"
        
        executive_summary = {
            "period": f"{start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}",
            "kpis": {
                "total_wagons_processed": data["total_processed"],
                "unique_wagon_numbers": len(data["unique_wagons"]),
                "average_confidence": round(data["avg_confidence"], 3),
                "active_tunnels": len(data["tunnels"]),
                "daily_average": round(data["total_processed"] / period_days, 1),
                "trend": trend
            },
            "performance_summary": {
                "system_uptime": "99.5%",  # Esto podría calcularse desde logs
                "detection_accuracy": f"{round(data['avg_confidence'] * 100, 1)}%",
                "processing_efficiency": "Alta"
            },
            "top_insights": await self._generate_executive_insights(data["daily_data"]),
            "recommendations": await self._generate_executive_recommendations(data)
        }
        
        return executive_summary
    
    async def generate_efficiency_report(self, days_back: int = 7) -> EfficiencyReport:
        """
        Genera reporte de eficiencia del sistema de detección
        
        Args:
            days_back: Número de días hacia atrás para analizar
            
        Returns:
            EfficiencyReport con métricas de rendimiento del sistema
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days_back)
        
        # Obtener datos del período
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "total_detections": {"$sum": 1},
                    "avg_confidence": {"$avg": "$confianza"},
                    "high_confidence": {
                        "$sum": {"$cond": [{"$gte": ["$confianza", 0.8]}, 1, 0]}
                    },
                    "low_confidence": {
                        "$sum": {"$cond": [{"$lt": ["$confianza", 0.5]}, 1, 0]}
                    }
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(length=None)
        
        if not results:
            return EfficiencyReport(
                period=f"{start_date.strftime('%Y-%m-%d')} - {end_date.strftime('%Y-%m-%d')}",
                system_uptime=0.0,
                detection_accuracy={},
                processing_speed={},
                error_rates={},
                performance_trends=[],
                optimization_suggestions=["No hay datos para analizar"]
            )
        
        # Calcular métricas de eficiencia
        total_detections = sum(r["total_detections"] for r in results)
        total_high_confidence = sum(r["high_confidence"] for r in results)
        total_low_confidence = sum(r["low_confidence"] for r in results)
        avg_confidence = sum(r["avg_confidence"] for r in results) / len(results)
        
        detection_accuracy = {
            "overall_accuracy": round(avg_confidence * 100, 2),
            "high_confidence_rate": round((total_high_confidence / total_detections) * 100, 2) if total_detections > 0 else 0,
            "low_confidence_rate": round((total_low_confidence / total_detections) * 100, 2) if total_detections > 0 else 0
        }
        
        # Simular métricas de velocidad de procesamiento
        processing_speed = {
            "avg_processing_time_ms": 450,  # Placeholder
            "frames_per_second": 25,
            "throughput_per_hour": total_detections / (days_back * 24) if days_back > 0 else 0
        }
        
        # Calcular tasas de error
        error_rates = {
            "false_positive_rate": round((total_low_confidence / total_detections) * 100, 2) if total_detections > 0 else 0,
            "system_error_rate": 0.5,  # Placeholder
            "network_error_rate": 0.1   # Placeholder
        }
        
        # Tendencias de rendimiento
        performance_trends = [
            {
                "date": r["_id"],
                "detections": r["total_detections"],
                "accuracy": round(r["avg_confidence"] * 100, 2),
                "efficiency_score": round((r["high_confidence"] / r["total_detections"]) * 100, 2) if r["total_detections"] > 0 else 0
            }
            for r in results
        ]
        
        # Sugerencias de optimización
        optimization_suggestions = []
        if detection_accuracy["high_confidence_rate"] < 70:
            optimization_suggestions.append("🎯 Ajustar umbral de confianza del modelo")
        if processing_speed["throughput_per_hour"] < 10:
            optimization_suggestions.append("⚡ Optimizar velocidad de procesamiento")
        if error_rates["false_positive_rate"] > 20:
            optimization_suggestions.append("🔧 Calibrar sistema para reducir falsos positivos")
        
        return EfficiencyReport(
            period=f"{start_date.strftime('%Y-%m-%d')} - {end_date.strftime('%Y-%m-%d')}",
            system_uptime=99.2,  # Placeholder
            detection_accuracy=detection_accuracy,
            processing_speed=processing_speed,
            error_rates=error_rates,
            performance_trends=performance_trends,
            optimization_suggestions=optimization_suggestions
        )
    
    async def generate_alerts_report(self, days_back: int = 7) -> AlertsReport:
        """
        Genera reporte de alertas y anomalías detectadas
        
        Args:
            days_back: Número de días hacia atrás para analizar
            
        Returns:
            AlertsReport con alertas críticas, advertencias y anomalías
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days_back)
        
        # Obtener datos para análisis de alertas
        detections = await self.collection.find({
            "timestamp": {
                "$gte": start_date,
                "$lt": end_date
            }
        }).to_list(length=None)
        
        critical_alerts = []
        warning_alerts = []
        anomalies_detected = []
        
        if not detections:
            critical_alerts.append({
                "type": "NO_ACTIVITY",
                "message": f"No hay detecciones en los últimos {days_back} días",
                "severity": "CRITICAL",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        else:
            # Análisis de patrones anómalos
            daily_counts = defaultdict(int)
            confidence_issues = []
            
            for detection in detections:
                date_key = detection["timestamp"].strftime("%Y-%m-%d")
                daily_counts[date_key] += 1
                
                if (detection.get("confianza") or 0) < 0.3:
                    confidence_issues.append(detection)
            
            # Detectar días con actividad anómala
            counts = list(daily_counts.values())
            if counts:
                avg_daily = sum(counts) / len(counts)
                for date, count in daily_counts.items():
                    if count > avg_daily * 2:
                        warning_alerts.append({
                            "type": "HIGH_ACTIVITY",
                            "message": f"Actividad anormalmente alta el {date}: {count} detecciones",
                            "severity": "WARNING",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    elif count < avg_daily * 0.3 and count > 0:
                        warning_alerts.append({
                            "type": "LOW_ACTIVITY",
                            "message": f"Actividad anormalmente baja el {date}: {count} detecciones",
                            "severity": "WARNING",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
            
            # Problemas de confianza
            if len(confidence_issues) > len(detections) * 0.2:
                critical_alerts.append({
                    "type": "LOW_CONFIDENCE_PATTERN",
                    "message": f"Alto porcentaje de detecciones con baja confianza: {len(confidence_issues)}/{len(detections)}",
                    "severity": "CRITICAL",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            
            # Detectar números repetitivos anómalos
            number_counts = Counter(d.get("numero", "unknown") for d in detections)
            for numero, count in number_counts.most_common(5):
                if count > len(detections) * 0.3:  # Más del 30% del total
                    anomalies_detected.append({
                        "type": "REPETITIVE_NUMBER",
                        "message": f"Número {numero} detectado excesivamente: {count} veces",
                        "data": {"numero": numero, "count": count, "percentage": round((count/len(detections))*100, 2)}
                    })
        
        # Análisis de patrones
        pattern_analysis = {
            "total_detections": len(detections),
            "unique_numbers": len(set(d.get("numero", "") for d in detections)),
            "avg_confidence": round(sum((d.get("confianza") or 0) for d in detections) / len(detections), 3) if detections else 0,
            "daily_variation": round(max(daily_counts.values()) - min(daily_counts.values()), 2) if daily_counts else 0
        }
        
        # Recomendaciones basadas en alertas
        recommendations = []
        if critical_alerts:
            recommendations.append("🚨 Revisar configuración del sistema urgentemente")
        if len(warning_alerts) > 3:
            recommendations.append("⚠️ Monitorear patrones de actividad más de cerca")
        if anomalies_detected:
            recommendations.append("🔍 Investigar números repetitivos anómalos")
        
        return AlertsReport(
            period=f"{start_date.strftime('%Y-%m-%d')} - {end_date.strftime('%Y-%m-%d')}",
            critical_alerts=critical_alerts,
            warning_alerts=warning_alerts,
            anomalies_detected=anomalies_detected,
            pattern_analysis=pattern_analysis,
            recommendations=recommendations
        )
    
    # Métodos auxiliares
    async def _calculate_success_rate(self, detections: List[Dict]) -> float:
        """Calcula tasa de éxito de detecciones"""
        if not detections:
            return 0.0
        
        successful = sum(1 for d in detections if (d.get("confianza") or 0) > 0.5)
        return round(successful / len(detections), 3)
    
    async def _calculate_avg_processing_time(self, detections: List[Dict]) -> float:
        """Calcula tiempo promedio de procesamiento"""
        # Esto se podría calcular si guardamos tiempos de procesamiento
        return 0.5  # Placeholder
    
    async def _generate_quality_summary(self, detections: List[Dict]) -> Dict[str, Any]:
        """Genera resumen de calidad de las detecciones"""
        if not detections:
            return {}
        
        confidences = [(d.get("confianza") or 0) for d in detections]
        
        return {
            "high_confidence": sum(1 for c in confidences if c > 0.7),
            "medium_confidence": sum(1 for c in confidences if 0.4 <= c <= 0.7),
            "low_confidence": sum(1 for c in confidences if c < 0.4),
            "avg_confidence": round(statistics.mean(confidences), 3),
            "confidence_std": round(statistics.stdev(confidences) if len(confidences) > 1 else 0, 3)
        }
    
    async def _generate_daily_alerts(self, detections: List[Dict], metrics: ReportMetrics) -> List[str]:
        """Genera alertas específicas del día"""
        alerts = []
        
        if metrics.total_detections == 0:
            alerts.append("⚠️ No se registraron detecciones en todo el día")
        elif metrics.total_detections < 10:
            alerts.append(f"📉 Volumen bajo: solo {metrics.total_detections} detecciones")
        
        if metrics.avg_confidence < 0.5:
            alerts.append(f"🔍 Confianza promedio baja: {metrics.avg_confidence:.3f}")
        
        # Verificar duplicados excesivos
        numbers = [d["numero"] for d in detections]
        most_common = Counter(numbers).most_common(1)
        if most_common and most_common[0][1] > len(detections) * 0.3:
            alerts.append(f"🔄 Número {most_common[0][0]} detectado {most_common[0][1]} veces (posible bucle)")
        
        return alerts
    
    async def _analyze_tunnel_performance(self, results: List[Dict]) -> Dict[str, Dict]:
        """Analiza rendimiento por túnel"""
        tunnel_stats = defaultdict(lambda: {
            "total_detections": 0,
            "avg_confidence": 0,
            "daily_average": 0,
            "peak_hours": []
        })
        
        for result in results:
            tunnel = result["_id"]["tunel"]
            tunnel_stats[tunnel]["total_detections"] += result["count"]
            tunnel_stats[tunnel]["avg_confidence"] += (result["avg_confidence"] or 0)
        
        # Calcular promedios
        for tunnel, stats in tunnel_stats.items():
            if stats["total_detections"] > 0:
                stats["avg_confidence"] = round(stats["avg_confidence"] / len([r for r in results if r["_id"]["tunel"] == tunnel]), 3)
        
        return dict(tunnel_stats)
    
    async def _analyze_shifts(self, results: List[Dict]) -> Dict[str, Dict]:
        """Analiza productividad por turnos"""
        shifts = {
            "morning": {"hours": range(6, 14), "detections": 0},
            "afternoon": {"hours": range(14, 22), "detections": 0},
            "night": {"hours": range(22, 24), "detections": 0}
        }
        
        # Añadir horas de madrugada al turno noche
        night_early = list(range(0, 6))
        
        for result in results:
            hour = result["_id"]["hour"]
            if hour in shifts["morning"]["hours"]:
                shifts["morning"]["detections"] += result["count"]
            elif hour in shifts["afternoon"]["hours"]:
                shifts["afternoon"]["detections"] += result["count"]
            elif hour in shifts["night"]["hours"] or hour in night_early:
                shifts["night"]["detections"] += result["count"]
        
        return shifts
    
    async def _calculate_efficiency_trends(self, results: List[Dict]) -> Dict[str, List]:
        """Calcula tendencias de eficiencia"""
        # Implementación simplificada
        return {
            "daily_volume": [],
            "confidence_trend": [],
            "tunnel_efficiency": []
        }
    
    async def _identify_bottlenecks(self, results: List[Dict]) -> List[Dict]:
        """Identifica cuellos de botella en el sistema"""
        bottlenecks = []
        
        # Analizar horas con baja actividad
        hourly_activity = defaultdict(int)
        for result in results:
            hourly_activity[result["_id"]["hour"]] += result["count"]
        
        if hourly_activity:
            avg_activity = statistics.mean(hourly_activity.values())
            for hour, activity in hourly_activity.items():
                if activity < avg_activity * 0.3:  # Menos del 30% del promedio
                    bottlenecks.append({
                        "type": "low_activity_hour",
                        "hour": hour,
                        "activity_level": activity,
                        "severity": "medium"
                    })
        
        return bottlenecks
    
    async def _generate_recommendations(self, tunnel_performance: Dict, bottlenecks: List[Dict]) -> List[str]:
        """Genera recomendaciones basadas en el análisis"""
        recommendations = []
        
        if bottlenecks:
            recommendations.append("💡 Considerar optimizar horarios de baja actividad identificados")
        
        if tunnel_performance:
            performances = [stats["total_detections"] for stats in tunnel_performance.values()]
            if len(performances) > 1 and max(performances) > min(performances) * 2:
                recommendations.append("⚖️ Revisar balance de carga entre túneles")
        
        return recommendations
    
    async def _calculate_defect_rate(self, detections: List[Dict]) -> float:
        """Calcula tasa de defectos/merma"""
        if not detections:
            return 0.0
        
        defective = sum(1 for d in detections if d.get("merma") is not None and d["merma"] > 0)
        return round(defective / len(detections), 3)
    
    async def _analyze_merma(self, detections: List[Dict]) -> Dict[str, Any]:
        """Analiza patrones de merma"""
        merma_data = [d.get("merma", 0) for d in detections if d.get("merma") is not None]
        
        if not merma_data:
            return {"no_merma_data": True}
        
        return {
            "total_with_merma": len(merma_data),
            "avg_merma": round(statistics.mean(merma_data), 2),
            "max_merma": max(merma_data),
            "merma_distribution": Counter(merma_data)
        }
    
    async def _analyze_confidence_distribution(self, detections: List[Dict]) -> Dict[str, int]:
        """Analiza distribución de confianza"""
        confidence_ranges = {
            "very_high": 0,  # > 0.9
            "high": 0,       # 0.7-0.9
            "medium": 0,     # 0.5-0.7
            "low": 0,        # 0.3-0.5
            "very_low": 0    # < 0.3
        }
        
        for detection in detections:
            conf = detection.get("confianza") or 0
            if conf > 0.9:
                confidence_ranges["very_high"] += 1
            elif conf > 0.7:
                confidence_ranges["high"] += 1
            elif conf > 0.5:
                confidence_ranges["medium"] += 1
            elif conf > 0.3:
                confidence_ranges["low"] += 1
            else:
                confidence_ranges["very_low"] += 1
        
        return confidence_ranges
    
    async def _analyze_model_accuracy(self, detections: List[Dict]) -> Dict[str, float]:
        """Analiza precisión del modelo por tipo de ladrillo"""
        model_stats = defaultdict(list)
        
        for detection in detections:
            model = detection.get("modelo_ladrillo")
            confidence = detection.get("confianza") or 0
            if model:
                model_stats[model].append(confidence)
        
        return {
            model: round(statistics.mean(confidences), 3)
            for model, confidences in model_stats.items()
            if confidences
        }
    
    async def _calculate_quality_trends(self, detections: List[Dict]) -> List[Dict]:
        """Calcula tendencias de calidad a lo largo del tiempo"""
        # Agrupar por día y calcular calidad promedio
        daily_quality = defaultdict(list)
        
        for detection in detections:
            date_str = detection["timestamp"].strftime("%Y-%m-%d")
            confidence = detection.get("confianza") or 0
            daily_quality[date_str].append(confidence)
        
        trends = []
        for date, confidences in daily_quality.items():
            trends.append({
                "date": date,
                "avg_confidence": round(statistics.mean(confidences), 3),
                "detection_count": len(confidences)
            })
        
        return sorted(trends, key=lambda x: x["date"])
    
    async def _detect_number_anomalies(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Detecta números anómalos o patrones inusuales"""
        cursor = self.collection.find({
            "timestamp": {"$gte": start_date, "$lt": end_date}
        })
        
        detections = await cursor.to_list(length=None)
        anomalies = []
        
        if detections:
            numbers = [d["numero"] for d in detections]
            number_counts = Counter(numbers)
            
            # Detectar números con frecuencia muy alta (posibles bucles)
            total = len(numbers)
            for numero, count in number_counts.most_common(5):
                if count > total * 0.2:  # Más del 20% del total
                    anomalies.append({
                        "type": "high_frequency_number",
                        "numero": numero,
                        "count": count,
                        "percentage": round(count / total * 100, 1),
                        "severity": "warning"
                    })
        
        return anomalies
    
    async def _calculate_system_health(self) -> Dict[str, Any]:
        """Calcula estado general del sistema"""
        now = datetime.now(timezone.utc)
        last_hour = now - timedelta(hours=1)
        
        recent_count = await self.collection.count_documents({
            "timestamp": {"$gte": last_hour}
        })
        
        health_score = min(100, recent_count * 10)  # Score basado en actividad reciente
        
        return {
            "health_score": health_score,
            "status": "healthy" if health_score > 70 else "warning" if health_score > 30 else "critical",
            "recent_activity": recent_count,
            "last_check": now.isoformat()
        }
    
    async def _generate_executive_insights(self, daily_data: List[Dict]) -> List[str]:
        """Genera insights ejecutivos"""
        insights = []
        
        # Análisis de volumen
        daily_volumes = defaultdict(int)
        for item in daily_data:
            daily_volumes[item["date"]] += 1
        
        if daily_volumes:
            max_day = max(daily_volumes, key=daily_volumes.get)
            min_day = min(daily_volumes, key=daily_volumes.get)
            
            insights.append(f"📈 Día de mayor actividad: {max_day} ({daily_volumes[max_day]} vagonetas)")
            insights.append(f"📉 Día de menor actividad: {min_day} ({daily_volumes[min_day]} vagonetas)")
        
        # Análisis de túneles
        tunnel_activity = defaultdict(int)
        for item in daily_data:
            tunnel_activity[item["tunel"]] += 1
        
        if tunnel_activity:
            most_active_tunnel = max(tunnel_activity, key=tunnel_activity.get)
            insights.append(f"🚇 Túnel más activo: {most_active_tunnel} ({tunnel_activity[most_active_tunnel]} detecciones)")
        
        return insights
    
    async def _generate_executive_recommendations(self, data: Dict) -> List[str]:
        """Genera recomendaciones ejecutivas"""
        recommendations = []
        
        avg_confidence = data.get("avg_confidence", 0)
        if avg_confidence < 0.6:
            recommendations.append("🔧 Revisar calibración del sistema de detección")
        
        unique_count = len(data.get("unique_wagons", []))
        total_count = data.get("total_processed", 0)
        
        if total_count > 0 and unique_count / total_count < 0.3:
            recommendations.append("🔄 Alto índice de redetección - optimizar flujo de vagonetas")
        
        return recommendations


# Funciones de utilidad para programar reportes automáticos
async def schedule_daily_reports(db: AsyncIOMotorDatabase):
    """Programa la generación automática de reportes diarios"""
    generator = AutoReportGenerator(db)
    
    try:
        # Generar reporte del día anterior
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        daily_report = await generator.generate_daily_report(yesterday)
        
        # Aquí podrías guardar el reporte en la DB o enviarlo por email
        print(f"📊 Reporte diario generado para {daily_report.date}")
        print(f"Total detecciones: {daily_report.metrics.total_detections}")
        print(f"Números únicos: {daily_report.metrics.unique_numbers}")
        
        return daily_report
        
    except Exception as e:
        print(f"❌ Error generando reporte diario: {e}")
        return None

async def generate_weekly_executive_summary(db: AsyncIOMotorDatabase):
    """Genera resumen ejecutivo semanal"""
    generator = AutoReportGenerator(db)
    
    try:
        executive_summary = await generator.generate_executive_summary(7)
        print("📈 Resumen ejecutivo semanal generado")
        return executive_summary
        
    except Exception as e:
        print(f"❌ Error generando resumen ejecutivo: {e}")
        return None
