import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const RealTimeMonitor = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    try {
      // Cargar cámaras disponibles
      const camerasRes = await axios.get('http://localhost:8000/cameras/list');
      setAvailableCameras(camerasRes.data.cameras || []);
      
      // Cargar historial reciente
      const historialRes = await axios.get('http://localhost:8000/historial/', {
        params: { limit: 10, skip: 0 }
      });
      setRecentDetections(historialRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setMonitorError('Error al cargar datos iniciales');
    }
  }, []);

  // Iniciar monitoreo
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
      }
    } catch (error) {
      setMonitorError(error.response?.data?.detail || 'Error al iniciar el monitoreo');
    }
  };

  // Detener monitoreo
  const stopMonitoring = async () => {
    try {
      const response = await axios.post(`http://localhost:8000/monitor/stop/${selectedCamera}`);
      if (response.data.status === 'stopped') {
        setIsMonitoring(false);
      }
    } catch (error) {
      setMonitorError(error.response?.data?.detail || 'Error al detener el monitoreo');
    }
  };

  useEffect(() => {
    loadInitialData();

    // WebSocket para recibir detecciones en tiempo real
    const wsUrl = 'ws://localhost:8000/ws/detections';
    
    const connectWebSocket = () => {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket conectado');
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'monitor_detection' || message.type === 'new_detection') {
          setRecentDetections(prev => [message.data, ...prev].slice(0, 10));
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [loadInitialData]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-cyan-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-cyan-800">
          📊 Monitor en Tiempo Real
        </h1>
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>

      {/* Panel de Control */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border-l-4 border-purple-500">
        <h2 className="text-xl font-bold text-purple-800 mb-4">
          🎥 Control de Cámaras
        </h2>
        
        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-purple-700 mb-2">
              Seleccionar Cámara
            </label>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full p-2 border border-purple-300 rounded-md"
              disabled={isMonitoring}
            >
              <option value="">-- Seleccione una cámara --</option>
              {availableCameras.map((camera) => (
                <option key={camera.camera_id} value={camera.camera_id}>
                  {camera.camera_id} - {camera.tunel}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              disabled={!selectedCamera}
              className={`w-full px-4 py-2 rounded-md font-medium ${
                !selectedCamera
                  ? 'bg-gray-300 text-gray-500'
                  : isMonitoring
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
            >
              {isMonitoring ? '⏹️ Detener' : '▶️ Iniciar'}
            </button>
          </div>
          
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
              isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
          </div>
        </div>
        
        {monitorError && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            {monitorError}
          </div>
        )}
      </div>

      {/* Detecciones Recientes */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold text-cyan-800 mb-4">
          🚛 Detecciones Recientes
        </h2>
        
        {recentDetections.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentDetections.map((detection, index) => (
              <div key={detection._id || index} className="flex items-center gap-4 p-3 bg-cyan-50 rounded-lg">
                {detection.imagen_path && (
                  <img 
                    src={`http://localhost:8000/${detection.imagen_path}`}
                    alt="detección"
                    className="w-16 h-16 rounded object-cover"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <div className="flex-1">
                  <div className="font-bold text-lg text-cyan-800">
                    #{detection.numero}
                  </div>
                  <div className="text-sm text-cyan-600">
                    {detection.tunel} • {detection.evento}
                  </div>
                  {detection.confianza && (
                    <div className="text-xs text-green-600">
                      Confianza: {Math.round(detection.confianza * 100)}%
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(detection.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <div>No hay detecciones recientes</div>
            <div className="text-sm">Las nuevas detecciones aparecerán aquí automáticamente</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeMonitor;
