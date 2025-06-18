import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const RealTimeMonitor = () => {
  // Estados para la cámara y video
  const [camera, setCamera] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [detections, setDetections] = useState([]);
  const [stats, setStats] = useState({
    detections: 0,
    confidence: 0,
    fps: 0
  });
  
  // WebSocket para detecciones en tiempo real
  const ws = useRef(null);
  const wsReconnectTimeout = useRef(null);

  // Cargar y configurar la cámara al inicio
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Detectar cámara conectada
        const response = await axios.get('http://localhost:8000/cameras/list');
        const cameras = response.data.cameras || [];
        
        if (cameras.length === 0) {
          setError('No se detectó ninguna cámara conectada');
          return;
        }
        
        // Usar la primera cámara detectada (webcam)
        setCamera(cameras[0]);
        setIsLoading(false);
      } catch (error) {
        console.error('Error al detectar cámara:', error);
        setError('Error al detectar cámara: ' + (error.response?.data?.detail || error.message));
        setIsLoading(false);
      }
    };

    initializeCamera();
  }, []);

  // Control de monitoreo
  const toggleMonitoring = async () => {
    if (!camera) return;

    try {
      if (!isMonitoring) {
        // Iniciar monitoreo
        const response = await axios.post(`http://localhost:8000/monitor/start/${camera.camera_id}`);
        if (response.data.status === 'started') {
          setIsMonitoring(true);
        }
      } else {
        // Detener monitoreo
        const response = await axios.post(`http://localhost:8000/monitor/stop/${camera.camera_id}`);
        if (response.data.status === 'stopped') {
          setIsMonitoring(false);
        }
      }
    } catch (error) {
      console.error('Error al controlar monitoreo:', error);
      setError('Error al controlar monitoreo: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Conectar WebSocket para detecciones en tiempo real
  useEffect(() => {
    if (!camera) return;

    const wsUrl = 'ws://localhost:8000/ws/detections';
    let mounted = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3 segundos entre intentos

    const connectWebSocket = () => {
      // No intentar reconectar si el componente está desmontado o alcanzamos el máximo de intentos
      if (!mounted || reconnectAttempts >= maxReconnectAttempts) {
        console.log('No se intentará reconectar: componente desmontado o máximo de intentos alcanzado');
        return;
      }

      // Si ya hay una conexión activa o en proceso, no crear otra
      if (ws.current?.readyState === WebSocket.CONNECTING || ws.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket ya está conectado o conectándose');
        return;
      }

      try {
        console.log(`Conectando WebSocket (intento ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log('✅ WebSocket conectado exitosamente');
          reconnectAttempts = 0; // Resetear intentos al conectar exitosamente
        };

        ws.current.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'detection' && (!data.camera_id || data.camera_id === camera.camera_id)) {
              // Validar que detection exista y tenga propiedades
              const detection = data.detection || data.data || {};
              setDetections(prev => [detection, ...prev].slice(0, 10));
              setStats(prev => ({
                detections: prev.detections + 1,
                confidence: typeof detection.confidence === 'number' ? detection.confidence : prev.confidence,
                fps: data.fps || prev.fps
              }));
            }
          } catch (error) {
            console.warn('Error al procesar mensaje WebSocket:', error);
          }
        };

        ws.current.onclose = (event) => {
          console.log(`WebSocket cerrado (código: ${event.code})`);
          
          // Si el cierre no fue intencional (código != 1000) y no excedimos intentos
          if (mounted && event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Intentando reconectar en ${reconnectDelay/1000} segundos...`);
            wsReconnectTimeout.current = setTimeout(connectWebSocket, reconnectDelay);
          }
        };

        ws.current.onerror = () => {
          // Solo logueamos que hubo un error, el manejo se hace en onclose
          console.log('❌ Error en la conexión WebSocket');
        };
      } catch (error) {
        console.error('Error al crear WebSocket:', error);
        // Intentar reconectar si aún no excedimos el límite
        if (mounted && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          wsReconnectTimeout.current = setTimeout(connectWebSocket, reconnectDelay);
        }
      }
    };

    connectWebSocket();

    return () => {
      mounted = false;
      if (wsReconnectTimeout.current) {
        clearTimeout(wsReconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close(1000, 'Componente desmontado');
        ws.current = null;
      }
    };
  }, [camera]);

  // Componente de video streaming
  const VideoStream = () => {
    if (!camera) return null;
    
    return (
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
        <img 
          src={`http://localhost:8000/video/stream/${camera.camera_id}`}
          alt="Video en vivo"
          className="w-full h-full object-contain"
        />
        <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {camera.name} - {camera.resolution}
        </div>
        {isMonitoring && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-500/50 text-white px-3 py-1 rounded-full text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Monitoreando
          </div>
        )}
      </div>
    );
  };

  // Tarjeta de detección individual
  const DetectionCard = ({ detection }) => (
    <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-lg font-bold text-gray-800">#{detection?.numero ?? 'N/A'}</div>
          <div className="text-sm text-gray-600">
            Confianza: {typeof detection?.confidence === 'number' ? Math.round(detection.confidence * 100) + '%' : 'N/A'}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {detection?.timestamp ? new Date(detection.timestamp).toLocaleTimeString() : ''}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Detectando cámara...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 p-6 rounded-lg max-w-md">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📹 Monitor en Vivo
        </h1>
        <p className="text-gray-600">
          Monitoreo de vagonetas en tiempo real usando la cámara conectada
        </p>
      </div>

      {/* Panel de Video y Controles */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Video Stream */}
          <VideoStream />

          {/* Controles */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">Control de Monitoreo</h3>
                <p className="text-sm text-gray-600">
                  {camera?.name} - {camera?.resolution}
                </p>
              </div>
              <button
                onClick={toggleMonitoring}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isMonitoring
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isMonitoring ? '⏹️ Detener' : '▶️ Iniciar'} Monitoreo
              </button>
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Estadísticas */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Estadísticas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{stats.detections}</div>
                <div className="text-sm text-green-600">Detecciones</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.fps}</div>
                <div className="text-sm text-blue-600">FPS</div>
              </div>
            </div>
          </div>

          {/* Últimas detecciones */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Últimas Detecciones</h3>
            <div className="space-y-3">
              {detections.length > 0 ? (
                detections.map((detection, index) => (
                  <DetectionCard key={index} detection={detection} />
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No hay detecciones recientes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitor;
