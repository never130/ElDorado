import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const RealTimeMonitor = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [autoStatus, setAutoStatus] = useState('stopped');
  const [modelInfo, setModelInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  
  // Monitor en vivo específico
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorStats, setMonitorStats] = useState({});
  const [monitorError, setMonitorError] = useState('');

  // Function to fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      // Obtener información del modelo
      if (!modelInfo) {
        const modelRes = await axios.get('http://localhost:8000/model/info');
        setModelInfo(modelRes.data);
      }
      
      // Obtener lista de cámaras disponibles
      const camerasRes = await axios.get('http://localhost:8000/cameras/list');
      setAvailableCameras(camerasRes.data.cameras || []);
      
      // Obtener estado del sistema automático inicial
      const statusRes = await axios.get('http://localhost:8000/auto-capture/status');
      setAutoStatus(statusRes.data.manager_running ? 'running' : 'stopped');
      setSystemStats(statusRes.data.cameras || []);

      // Obtener un historial inicial de detecciones
      const recentRes = await axios.get('http://localhost:8000/historial/', {
        params: { limit: 10, skip: 0 }
      });
      setRecentDetections(recentRes.data);

    } catch (error) {
      console.error('Error fetching initial data:', error);
      setMonitorError('Error al cargar datos iniciales');
    }
  }, [modelInfo]);

  // Función para iniciar el monitoreo de una cámara específica
  const startMonitoring = async () => {
    if (!selectedCamera) {
      setMonitorError('Debe seleccionar una cámara');
      return;
    }

    try {
      setMonitorError('');
      const response = await axios.post(`http://localhost:8000/monitor/start/${selectedCamera}`);
      if (response.data.status === 'started') {
        setIsMonitoring(true);
        console.log('Monitoreo iniciado para cámara:', selectedCamera);
      }
    } catch (error) {
      console.error('Error starting monitor:', error);
      setMonitorError(error.response?.data?.detail || 'Error al iniciar el monitoreo');
    }
  };

  // Función para detener el monitoreo
  const stopMonitoring = async () => {
    if (!selectedCamera) return;

    try {
      setMonitorError('');
      const response = await axios.post(`http://localhost:8000/monitor/stop/${selectedCamera}`);
      if (response.data.status === 'stopped') {
        setIsMonitoring(false);
        setMonitorStats({});
        console.log('Monitoreo detenido para cámara:', selectedCamera);
      }
    } catch (error) {
      console.error('Error stopping monitor:', error);
      setMonitorError(error.response?.data?.detail || 'Error al detener el monitoreo');
    }
  };

  // Función para obtener el estado del monitoreo
  const fetchMonitorStatus = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/monitor/status');
      const data = response.data;
      
      if (data.active_monitors && data.active_monitors.length > 0) {
        const activeMonitor = data.active_monitors.find(m => m.camera_id === selectedCamera);
        if (activeMonitor) {
          setIsMonitoring(true);
          setMonitorStats(activeMonitor.stats || {});
        } else {
          setIsMonitoring(false);
          setMonitorStats({});
        }
      } else {
        setIsMonitoring(false);
        setMonitorStats({});
      }
    } catch (error) {
      console.error('Error fetching monitor status:', error);
    }
  }, [selectedCamera]);

  useEffect(() => {
    fetchInitialData();

    // WebSocket connection URL
    const wsUrl = 'ws://localhost:8000/ws/detections';

    function connectWebSocket() {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        // Obtener estado actual al conectarse
        axios.get('http://localhost:8000/auto-capture/status')
          .then(statusRes => {
            setAutoStatus(statusRes.data.manager_running ? 'running' : 'stopped'); 
            setSystemStats(statusRes.data.cameras || []);
          })
          .catch(err => console.error('Error fetching status on WS connect:', err));
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket Message:', message);

        if (message.type === 'new_detection') {
          setRecentDetections(prevDetections => 
            [message.data, ...prevDetections].slice(0, 10)
          );
          // Actualizar estadísticas
          axios.get('http://localhost:8000/auto-capture/status')
            .then(statusRes => {
                setAutoStatus(statusRes.data.manager_running ? 'running' : 'stopped');
                setSystemStats(statusRes.data.cameras || []);
            })
            .catch(err => console.error('Error fetching status on new detection:', err));

        } else if (message.type === 'system_status') {
            setAutoStatus(message.data.manager_running ? 'running' : 'stopped');
            setSystemStats(message.data.cameras || []);
        } else if (message.type === 'monitor_detection') {
          // Nueva detección del monitor en vivo
          setRecentDetections(prevDetections => 
            [message.data, ...prevDetections].slice(0, 10)
          );
          // Actualizar estadísticas del monitor si es la cámara seleccionada
          if (message.data.camera_id === selectedCamera) {
            fetchMonitorStatus();
          }
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    }

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [fetchInitialData, selectedCamera, fetchMonitorStatus]);

  // Actualizar estado del monitor cuando cambia la cámara seleccionada
  useEffect(() => {
    if (selectedCamera) {
      fetchMonitorStatus();
    }
  }, [selectedCamera, fetchMonitorStatus]);

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
              onError={(e) => {
                e.target.style.display = 'none';
              }}
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
            {detection.confianza && (
              <div className="text-xs font-mono mt-1">
                {Math.round(detection.confianza * 100)}%
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
  const totalDetections = Array.isArray(systemStats) ? systemStats.reduce(
    (acc, cameraStats) => acc + (cameraStats?.stats?.vagonetas_detected || 0), 0
  ) : 0;
  
  const totalMotion = Array.isArray(systemStats) ? systemStats.reduce(
    (acc, cameraStats) => acc + (cameraStats?.stats?.motion_detected || 0), 0
  ) : 0;

  const efficiency = totalMotion > 0 ? Math.round((totalDetections / totalMotion) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-cyan-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-cyan-800">
          📡 Monitor en Vivo
        </h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? (autoStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500') : 'bg-yellow-500'
          }`}></div>
          <span className="font-semibold">
            {isConnected ? (autoStatus === 'running' ? 'Sistema Activo' : 'Sistema Inactivo') : 'Conectando...'}
          </span>
        </div>
      </div>

      {/* Panel de Control del Monitor en Vivo */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border-l-4 border-purple-500">
        <h2 className="text-xl font-bold text-purple-800 mb-4">
          🎥 Control de Monitor en Vivo
        </h2>
        
        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-purple-700 mb-2">
              Seleccionar Cámara
            </label>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full p-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              disabled={isMonitoring}
            >
              <option value="">-- Seleccione una cámara --</option>
              {availableCameras.map((camera) => (
                <option key={camera.camera_id} value={camera.camera_id}>
                  {camera.camera_id} ({camera.evento}) - {camera.tunel}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              disabled={!selectedCamera}
              className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                !selectedCamera
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isMonitoring
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isMonitoring ? '⏹️ Detener Monitor' : '▶️ Iniciar Monitor'}
            </button>
          </div>
          
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isMonitoring 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
          </div>
        </div>
        
        {monitorError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {monitorError}
          </div>
        )}
        
        {isMonitoring && selectedCamera && (
          <div className="mt-4 p-4 bg-purple-50 rounded-md">
            <h3 className="font-medium text-purple-800 mb-2">
              Estadísticas de Monitoreo - {selectedCamera}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-purple-600">Frames:</span>
                <div className="font-semibold">{monitorStats.frames_processed || 0}</div>
              </div>
              <div>
                <span className="text-purple-600">Movimientos:</span>
                <div className="font-semibold">{monitorStats.motion_detected || 0}</div>
              </div>
              <div>
                <span className="text-green-600">Detecciones:</span>
                <div className="font-semibold text-green-700">{monitorStats.vagonetas_detected || 0}</div>
              </div>
              <div>
                <span className="text-orange-600">Falsos +:</span>
                <div className="font-semibold text-orange-700">{monitorStats.false_positives || 0}</div>
              </div>
            </div>
          </div>
        )}
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
          {autoStatus === 'running' && Array.isArray(systemStats) && systemStats.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-cyan-800 mb-3">
                🎥 Por Cámara
              </h3>
              {systemStats.map((cameraData) => (
                <div key={cameraData.camera_id} className="bg-white rounded-lg p-3 mb-3 shadow-sm">
                  <div className="font-semibold text-cyan-700 mb-2">{cameraData.camera_id} ({cameraData.evento})</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Frames: {cameraData.stats.frames_processed}</div>
                    <div>Movimientos: {cameraData.stats.motion_detected}</div>
                    <div className="text-green-600 font-semibold">
                      Vagonetas: {cameraData.stats.vagonetas_detected}
                    </div>
                    <div className="text-orange-600">
                      Falsos +: {cameraData.stats.false_positives}
                    </div>
                    {cameraData.source_type === 'video' && cameraData.video_progress && (
                      <div className="col-span-2 text-xs text-gray-500">Progreso Video: {cameraData.video_progress}</div>
                    )}
                  </div>
                </div>
              ))}
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
          🧠 Información del Modelo de Detección
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-cyan-50 rounded p-3">
            <div className="font-semibold text-cyan-700">Modelo Activo</div>
            <div className="text-cyan-600">{modelInfo ? modelInfo.model_type : 'Cargando...'}</div>
            <div className="text-xs text-cyan-500 mt-1">
              Optimizado para la identificación de vagonetas
            </div>
          </div>
          <div className="bg-green-50 rounded p-3">
            <div className="font-semibold text-green-700">Clases Detectables</div>
            <div className="text-green-600">{modelInfo ? modelInfo.classes_count : '...'} clases</div>
            <div className="text-xs text-green-500 mt-1">
              Números y/o tipos de vagonetas
            </div>
          </div>
          <div className="bg-orange-50 rounded p-3">
            <div className="font-semibold text-orange-700">Confianza Mínima</div>
            <div className="text-orange-600">{modelInfo ? modelInfo.confidence_threshold : '...'}</div>
            <div className="text-xs text-orange-500 mt-1">
              Umbral para considerar una detección válida
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitor;
