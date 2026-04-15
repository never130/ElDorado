import React, { useState, useEffect } from 'react';
import { API_BASE_URL as API_BASE } from '../config/api';

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('daily');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [daysBack, setDaysBack] = useState(7);

  const reportTypes = [
    { id: 'daily', name: 'Reporte Diario', icon: '📊', description: 'Actividad diaria con métricas y distribución horaria' },
    { id: 'productivity', name: 'Productividad', icon: '📈', description: 'Análisis de productividad por túneles y turnos' },
    { id: 'quality', name: 'Calidad', icon: '🎯', description: 'Análisis de calidad, merma y precisión del modelo' },
    { id: 'efficiency', name: 'Eficiencia', icon: '⚡', description: 'Métricas de rendimiento del sistema de detección' },
    { id: 'alerts', name: 'Alertas', icon: '🚨', description: 'Anomalías y patrones inusuales detectados' },
    { id: 'executive', name: 'Resumen Ejecutivo', icon: '👔', description: 'KPIs principales y tendencias para la gerencia' }
  ];

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `${API_BASE}/reports/${selectedReport}`;
      
      // Agregar parámetros según el tipo de reporte
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
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, dateFilter, daysBack]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateReport = () => {
    fetchReport();
  };

  const renderReportContent = () => {
    if (!reportData || !reportData.data) return null;

    const data = reportData.data;

    switch (selectedReport) {
      case 'daily':
        return (
          <div className="space-y-6">
            {/* Métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-blue-800 font-semibold">Total Detecciones</h4>
                <p className="text-2xl font-bold text-blue-900">{data.metrics.total_detections}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-green-800 font-semibold">Números Únicos</h4>
                <p className="text-2xl font-bold text-green-900">{data.metrics.unique_numbers}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="text-purple-800 font-semibold">Confianza Promedio</h4>
                <p className="text-2xl font-bold text-purple-900">{(data.metrics.avg_confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="text-orange-800 font-semibold">Tasa de Éxito</h4>
                <p className="text-2xl font-bold text-orange-900">{(data.metrics.success_rate * 100).toFixed(1)}%</p>
              </div>
            </div>

            {/* Distribución por túneles */}
            {Object.keys(data.tunnel_breakdown).length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Actividad por Túnel</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(data.tunnel_breakdown).map(([tunnel, count]) => (
                    <div key={tunnel} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="font-medium">{tunnel}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top números */}
            {data.top_numbers.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Números Más Frecuentes</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {data.top_numbers.slice(0, 10).map(([number, count], index) => (
                    <div key={number} className="flex items-center justify-between p-2 bg-yellow-50 rounded border">
                      <span className="font-mono text-sm">{number}</span>
                      <span className="text-xs bg-yellow-200 px-1 rounded">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas */}
            {data.alerts.length > 0 && (
              <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                <h4 className="text-lg font-semibold text-red-800 mb-4">Alertas del Día</h4>
                <ul className="space-y-2">
                  {data.alerts.map((alert, index) => (
                    <li key={index} className="text-red-700">{alert}</li>
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
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );

      default:
        return <div>Tipo de reporte no reconocido</div>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Sistema de Reportes</h1>
        <p className="text-gray-600">Análisis automático y insights del sistema de monitoreo de vagonetas</p>
      </div>

      {/* Selector de tipo de reporte */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {reportTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedReport(type.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
              selectedReport === type.id
                ? 'border-orange-500 bg-orange-50 text-orange-900'
                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{type.icon}</span>
              <h3 className="font-semibold">{type.name}</h3>
            </div>
            <p className="text-sm opacity-75">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Controles de filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {selectedReport === 'daily' ? (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Fecha:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Días hacia atrás:</label>
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value={1}>1 día</option>
                <option value={7}>7 días</option>
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                {selectedReport === 'executive' && <option value={90}>90 días</option>}
              </select>
            </div>
          )}
          
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '⏳ Generando...' : '🔄 Actualizar Reporte'}
          </button>
        </div>
      </div>

      {/* Contenido del reporte */}
      <div className="min-h-96">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Generando reporte...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">❌ Error al generar reporte</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={handleGenerateReport}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && reportData && (
          <div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {reportTypes.find(t => t.id === selectedReport)?.name}
                </h2>
                <div className="text-sm text-gray-500 mt-2 md:mt-0">
                  Generado: {new Date(reportData.generated_at).toLocaleString('es-ES')}
                </div>
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
