import React, { useState, useEffect, useRef, useCallback } from 'react'; // MODIFIED: Combined imports
import axios from 'axios';
// import Spinner from './Spinner'; // Comentado si no se usa
// import { Link } from 'react-router-dom'; // Comentado si no se usa
// import { API_BASE_URL, API_ENDPOINTS } from '../config/api'; // Corregida la importación // MODIFIED: Commented out as it's unused

const RealTimeMonitor = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [autoStatus, setAutoStatus] = useState('stopped');
  const [modelInfo, setModelInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status
  const ws = useRef(null); // WebSocket reference

  // Function to fetch initial data (like model info and initial history)
  const fetchInitialData = useCallback(async () => { // MODIFIED: Kept this function, ensured useCallback
    try {
      // Obtener información del modelo (solo la primera vez o si no está)
      if (!modelInfo) {
        const modelRes = await axios.get('http://localhost:8000/model/info');
        setModelInfo(modelRes.data);
      }
      // Obtener estado del sistema automático inicial
      const statusRes = await axios.get('http://localhost:8000/auto-capture/status');
      setAutoStatus(statusRes.data.status);
      setSystemStats(statusRes.data.statistics || {});

      // Obtener un historial inicial de detecciones
      const recentRes = await axios.get('http://localhost:8000/vagonetas/', {
        params: { limit: 10, order: 'desc' }
      });
      setRecentDetections(recentRes.data.slice(0, 10));

    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  }, [modelInfo]); // MODIFIED: modelInfo as dependency for useCallback

  // useEffect(() => { // REMOVED: Polling useEffect from HEAD
  //   fetchData();
  //   const interval = setInterval(fetchData, 10000); 
  //   return () => clearInterval(interval);
  // }, [fetchData]);

  useEffect(() => { // MODIFIED: Kept this useEffect, added fetchInitialData to dependencies
    fetchInitialData(); // Fetch initial data on component mount

    // WebSocket connection URL
    const wsUrl = 'ws://localhost:8000/ws/detections';

    function connectWebSocket() {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        // Optionally, fetch current auto-capture status upon connection
        // to ensure UI consistency if status changed while disconnected.
        axios.get('http://localhost:8000/auto-capture/status')
          .then(statusRes => {
            setAutoStatus(statusRes.data.status);
            setSystemStats(statusRes.data.statistics || {});
          })
          .catch(err => console.error('Error fetching status on WS connect:', err));
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket Message:', message);

        if (message.type === 'new_detection') {
          setRecentDetections(prevDetections => 
            [message.data, ...prevDetections].slice(0, 10) // Add to top, keep last 10
          );
          // Optionally update system stats if the message contains them or fetch them
          // For now, we assume new_detection might imply a change in stats, so we refetch.
          // A more optimized approach would be for the backend to send updated stats with the detection.
          axios.get('http://localhost:8000/auto-capture/status')
            .then(statusRes => {
                setAutoStatus(statusRes.data.status); // Update status as well
                setSystemStats(statusRes.data.statistics || {});
            })
            .catch(err => console.error('Error fetching status on new detection:', err));

        } else if (message.type === 'system_status') { // Example: if backend sends status updates
            setAutoStatus(message.data.status);
            setSystemStats(message.data.statistics || {});
        }
        // Potentially handle other message types, e.g., for auto-capture status changes directly
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000); // Reconnect every 5 seconds
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        // onclose will be called next, which handles reconnection
      };
    }

    connectWebSocket();

    // Cleanup WebSocket connection when component unmounts
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInitialData]); // MODIFIED: Added fetchInitialData to dependency array

  // The fetchData function is no longer needed for polling recentDetections or autoStatus if WS is primary.
  // It's kept as fetchInitialData for the first load.

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
            isConnected ? (autoStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500') : 'bg-yellow-500' // Yellow for connecting/disconnected
          }`}></div>
          <span className="font-semibold">
            {isConnected ? (autoStatus === 'running' ? 'Sistema Activo' : 'Sistema Inactivo') : 'Conectando...'}
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
