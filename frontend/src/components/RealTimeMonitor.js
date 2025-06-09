import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RealTimeMonitor = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [autoStatus, setAutoStatus] = useState('stopped');
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    const interval = setInterval(fetchData, 2000); // Actualizar cada 2 segundos
    fetchData();
    return () => clearInterval(interval);
  }, []);
  const fetchData = async () => {
    try {
      // Obtener detecciones recientes
      const recentRes = await axios.get('http://localhost:8000/vagonetas/', {
        params: { limit: 10, order: 'desc' }
      });
      setRecentDetections(recentRes.data.slice(0, 10));

      // Obtener estado del sistema automático
      const statusRes = await axios.get('http://localhost:8000/auto-capture/status');
      setAutoStatus(statusRes.data.status);
      setSystemStats(statusRes.data.statistics || {});

      // Obtener información del modelo (solo la primera vez)
      if (!modelInfo) {
        const modelRes = await axios.get('http://localhost:8000/model/info');
        setModelInfo(modelRes.data);
      }
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    }
  };

  const DetectionCard = ({ detection }) => {
    const timeAgo = (timestamp) => {
      const diff = Date.now() - new Date(timestamp).getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    };

    return (
      <div className={`bg-white rounded-lg p-3 border-l-4 shadow-sm ${
        detection.evento === 'ingreso' ? 'border-green-500' : 'border-orange-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={`http://localhost:8000/${detection.imagen_path}`}
              alt="vagoneta"
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <div className="font-bold text-lg text-cyan-800">
                #{detection.numero}
              </div>
              <div className="text-sm text-cyan-600">
                {detection.tunel} • {detection.evento}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-500">
              hace {timeAgo(detection.timestamp)}
            </div>
            {detection.auto_captured && (
              <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-1">
                🤖 Auto
              </div>
            )}
            {detection.confidence && (
              <div className="text-xs font-mono mt-1">
                {Math.round(detection.confidence * 100)}%
              </div>
            )}
          </div>
        </div>
        
        {detection.modelo_ladrillo && (
          <div className="mt-2 text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded inline-block">
            {detection.modelo_ladrillo}
          </div>
        )}
      </div>
    );
  };

  const StatCard = ({ title, value, subtitle, color = 'cyan' }) => (
    <div className={`bg-white rounded-lg p-4 border-l-4 border-${color}-500 shadow-sm`}>
      <div className={`text-2xl font-bold text-${color}-800`}>{value}</div>
      <div className={`text-sm text-${color}-600`}>{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );

  // Calcular estadísticas globales
  const totalDetections = Object.values(systemStats).reduce(
    (acc, stats) => acc + (stats?.vagonetas_detected || 0), 0
  );
  
  const totalMotion = Object.values(systemStats).reduce(
    (acc, stats) => acc + (stats?.motion_detected || 0), 0
  );

  const efficiency = totalMotion > 0 ? Math.round((totalDetections / totalMotion) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-cyan-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-cyan-800">
          📊 Monitor en Tiempo Real
        </h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            autoStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <span className="font-semibold">
            Sistema {autoStatus === 'running' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Panel de estadísticas */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-bold text-cyan-800 mb-4">
            📈 Estadísticas del Sistema
          </h2>
          
          <div className="space-y-4">
            <StatCard 
              title="Vagonetas Detectadas Hoy"
              value={totalDetections}
              subtitle="Total acumulado"
              color="green"
            />
            
            <StatCard 
              title="Eficiencia de Detección"
              value={`${efficiency}%`}
              subtitle={`${totalDetections}/${totalMotion} movimientos`}
              color="blue"
            />
            
            <StatCard 
              title="Últimas Detecciones"
              value={recentDetections.length}
              subtitle="En los últimos registros"
              color="orange"
            />
          </div>

          {/* Estadísticas por cámara */}
          {autoStatus === 'running' && Object.keys(systemStats).length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-cyan-800 mb-3">
                🎥 Por Cámara
              </h3>
              {Object.entries(systemStats).map(([cameraId, stats]) => (
                <div key={cameraId} className="bg-white rounded-lg p-3 mb-3 shadow-sm">
                  <div className="font-semibold text-cyan-700 mb-2">{cameraId}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Frames: {stats.frames_processed}</div>
                    <div>Movimientos: {stats.motion_detected}</div>
                    <div className="text-green-600 font-semibold">
                      Vagonetas: {stats.vagonetas_detected}
                    </div>
                    <div className="text-orange-600">
                      Falsos +: {stats.false_positives}
                    </div>
                  </div>
                </div>              ))}
            </div>
          )}

          {/* Información del Modelo IA */}
          {modelInfo && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-purple-800 mb-3">
                🧠 Modelo IA Activo
              </h3>
              <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-purple-700">Tipo:</span> {modelInfo.model_type}
                  </div>
                  <div>
                    <span className="font-semibold text-purple-700">Clases:</span> {modelInfo.classes_count}
                  </div>
                  <div>
                    <span className="font-semibold text-purple-700">Confianza:</span> {modelInfo.confidence_threshold}
                  </div>
                  <div>
                    <span className="font-semibold text-purple-700">Épocas:</span> {modelInfo.training_epochs}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  Dataset: {modelInfo.dataset}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel de detecciones recientes */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-cyan-800 mb-4">
            🚛 Detecciones Recientes
          </h2>
          
          {recentDetections.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentDetections.map((detection, index) => (
                <DetectionCard key={detection._id || index} detection={detection} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm">
              <div className="text-6xl mb-4">🔍</div>
              <div className="text-cyan-600 text-lg">
                No hay detecciones recientes
              </div>
              <div className="text-cyan-500 text-sm mt-2">
                Las nuevas detecciones aparecerán aquí automáticamente
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel de información del modelo */}
      <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-cyan-800 mb-4">
          🧠 Información del Modelo NumerosCalados
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-cyan-50 rounded p-3">
            <div className="font-semibold text-cyan-700">Modelo Activo</div>
            <div className="text-cyan-600">YOLOv8 NumerosCalados</div>
            <div className="text-xs text-cyan-500 mt-1">
              Optimizado para números calados
            </div>
          </div>
          <div className="bg-green-50 rounded p-3">
            <div className="font-semibold text-green-700">Clases Detectables</div>
            <div className="text-green-600">29 números diferentes</div>
            <div className="text-xs text-green-500 mt-1">
              01, 010, 011, 012, 0123, etc.
            </div>
          </div>
          <div className="bg-orange-50 rounded p-3">
            <div className="font-semibold text-orange-700">Precisión</div>
            <div className="text-orange-600">Alta confianza</div>
            <div className="text-xs text-orange-500 mt-1">
              Entrenado específicamente para este caso
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitor;
