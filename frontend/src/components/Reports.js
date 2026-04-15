import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL as API_BASE } from '../config/api';
import { FileText, BarChart3, Activity, AlertCircle, Briefcase, Calendar, TrendingUp, Download, CheckCircle2, Search, Target, PieChart, Layers, Clock, RefreshCw } from 'lucide-react';
import Spinner from './Spinner';

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('daily');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [daysBack, setDaysBack] = useState(7);

  const reportTypes = [
    { id: 'daily', name: 'Reporte Diario', icon: Calendar, description: 'Actividad diaria con métricas y distribución horaria' },
    { id: 'productivity', name: 'Productividad', icon: TrendingUp, description: 'Análisis de productividad por túneles y turnos' },
    { id: 'quality', name: 'Calidad', icon: Target, description: 'Análisis de calidad, merma y precisión del modelo' },
    { id: 'efficiency', name: 'Eficiencia', icon: Activity, description: 'Métricas de rendimiento del sistema de detección' },
    { id: 'alerts', name: 'Alertas', icon: AlertCircle, description: 'Anomalías y patrones inusuales detectados' },
    { id: 'executive', name: 'Resumen Ejecutivo', icon: Briefcase, description: 'KPIs principales y tendencias para la gerencia' }
  ];

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `${API_BASE}/reports/${selectedReport}`;
      
      if (selectedReport === 'daily' && dateFilter) {
        url += `?date=${dateFilter}`;
      } else if (selectedReport !== 'daily') {
        url += `?days_back=${daysBack}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, dateFilter, daysBack]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleGenerateReport = () => {
    fetchReport();
  };

  const renderReportContent = () => {
    if (!reportData || !reportData.data) return null;

    const data = reportData.data;

    switch (selectedReport) {
      case 'daily':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h4 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-1 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange-500" /> Total Detecciones</h4>
                <p className="text-3xl font-bold text-slate-900">{data.metrics.total_detections}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h4 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-1 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-500" /> Números Únicos</h4>
                <p className="text-3xl font-bold text-slate-900">{data.metrics.unique_numbers}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h4 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-1 flex items-center gap-2"><Activity className="w-4 h-4 text-purple-500" /> Confianza Promedio</h4>
                <p className="text-3xl font-bold text-slate-900">{(data.metrics.avg_confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h4 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-1 flex items-center gap-2"><Target className="w-4 h-4 text-orange-500" /> Tasa de Éxito</h4>
                <p className="text-3xl font-bold text-slate-900">{(data.metrics.success_rate * 100).toFixed(1)}%</p>
              </div>
            </div>

            {Object.keys(data.tunnel_breakdown).length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-orange-600" /> Actividad por Túnel</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(data.tunnel_breakdown).map(([tunnel, count]) => (
                    <div key={tunnel} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-700 capitalize">{tunnel}</span>
                      <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-md text-sm font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.top_numbers && data.top_numbers.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Números Más Frecuentes</h4>
                <div className="flex flex-wrap gap-3">
                  {data.top_numbers.slice(0, 10).map(([number, count], index) => (
                    <div key={number} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100 min-w-[120px]">
                      <span className="font-bold text-slate-800 text-lg">{number}</span>
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-md font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.alerts && data.alerts.length > 0 && (
              <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
                <h4 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Alertas del Día</h4>
                <ul className="space-y-3">
                  {data.alerts.map((alert, index) => (
                    <li key={index} className="text-red-700 bg-white p-3 rounded-lg border border-red-100 shadow-sm text-sm font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {alert}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'productivity':
      case 'quality':
      case 'efficiency':
      case 'alerts':
      case 'executive':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <pre className="text-sm text-slate-700 whitespace-pre-wrap overflow-auto bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-[500px] custom-scrollbar">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );

      default:
        return <div className="p-4 bg-slate-50 text-slate-500 rounded-lg text-center">Tipo de reporte no reconocido</div>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-orange-600" /> Sistema de Reportes
          </h1>
          <p className="text-slate-600 text-lg">Análisis automático y métricas del sistema de monitoreo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedReport(type.id)}
              className={`p-5 rounded-xl border-2 text-left transition-all duration-200 group ${
                selectedReport === type.id
                  ? 'border-orange-500 bg-orange-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-orange-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${selectedReport === type.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500 group-hover:text-orange-600'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className={`font-bold text-lg ${selectedReport === type.id ? 'text-orange-900' : 'text-slate-800'}`}>{type.name}</h3>
              </div>
              <p className={`text-sm ${selectedReport === type.id ? 'text-orange-700/80' : 'text-slate-500'}`}>{type.description}</p>
            </button>
          );
        })}
      </div>

      <div className="card p-5 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            {selectedReport === 'daily' ? (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-500" /> Fecha del reporte</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="input-field max-w-xs"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-500" /> Período de análisis</label>
                <select
                  value={daysBack}
                  onChange={(e) => setDaysBack(parseInt(e.target.value))}
                  className="input-field max-w-xs"
                >
                  <option value={1}>Últimas 24 horas</option>
                  <option value={7}>Últimos 7 días</option>
                  <option value={15}>Últimos 15 días</option>
                  <option value={30}>Últimos 30 días</option>
                  {selectedReport === 'executive' && <option value={90}>Últimos 90 días (Trimestre)</option>}
                </select>
              </div>
            )}
          </div>
          
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="btn-primary w-full sm:w-auto px-6 py-2.5"
          >
            {loading ? (
              <><Spinner size={18} color="#ffffff" /> <span className="ml-2">Generando...</span></>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Reporte</>
            )}
          </button>
        </div>
      </div>

      <div className="min-h-[400px]">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 bg-white/50 rounded-xl border border-slate-200 border-dashed animate-pulse">
            <Spinner size={48} color="#ea580c" />
            <p className="text-slate-600 mt-4 font-medium">Analizando datos y generando reporte...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center flex flex-col items-center animate-in fade-in">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <h3 className="text-xl text-red-800 font-bold mb-2">Error al generar el reporte</h3>
            <p className="text-red-600 mb-6 max-w-md">{error}</p>
            <button
              onClick={handleGenerateReport}
              className="btn-danger"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && reportData && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {reportTypes.find(t => t.id === selectedReport)?.name}
              </h2>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <Clock className="w-4 h-4 text-slate-400" />
                Generado: {new Date(reportData.generated_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            {renderReportContent()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
