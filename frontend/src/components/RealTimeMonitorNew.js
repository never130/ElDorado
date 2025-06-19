import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const RealTimeMonitorNew = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  const ws = useRef(null);
  const wsReconnectTimeout = useRef(null);

  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }
    ws.current = new WebSocket('ws://localhost:8000/ws/detections');
    ws.current.onopen = () => {
      console.log('WebSocket conectado');
      setIsConnected(true);
    };
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WS Message:', message);
        switch (message.type) {
          case 'new_detection':
            setRecentDetections(prev => [message.data, ...prev].slice(0, 10));
            break;
          case 'debug_info':
            setDebugInfo(message.data);
            break;
          case 'monitor_status':
            setIsMonitoring(message.data.status === 'started');
            if(message.data.status === 'started') setMonitorError('');
            break;
          case 'monitor_error':
            setMonitorError(message.data.error);
            setIsMonitoring(false);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    ws.current.onerror = (error) => console.error('WebSocket error:', error);
    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket desconectado. Intentando reconectar...');
      if (wsReconnectTimeout.current) clearTimeout(wsReconnectTimeout.current);
      wsReconnectTimeout.current = setTimeout(connectWebSocket, 5000);
    };
  }, []);
  const loadInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const camerasRes = await axios.get('http://localhost:8000/cameras/list');
      // Asegurarse de que estamos accediendo a cameras.cameras (el array dentro del objeto)
      const camerasArray = camerasRes.data && camerasRes.data.cameras ? camerasRes.data.cameras : [];
      setAvailableCameras(camerasArray);
      console.log('📸 Cámaras cargadas:', camerasArray);
      
      if (camerasArray.length > 0) {
        setSelectedCamera(camerasArray[0].camera_id);
      }
      const historyRes = await axios.get('http://localhost:8000/historial/?limit=10');
      setRecentDetections(historyRes.data.registros || []);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      setMonitorError('No se pudo conectar con el backend. Verifique que esté en ejecución.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close(1000, 'Component unmounting');
      if (wsReconnectTimeout.current) clearTimeout(wsReconnectTimeout.current);
    };
  }, [loadInitialData, connectWebSocket]);

  const startMonitoring = async () => {
    if (!selectedCamera) return;
    setMonitorError('');
    setDebugInfo(null);
    try {
      await axios.post(`http://localhost:8000/monitor/start/${selectedCamera}`);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error desconocido al iniciar.';
      setMonitorError(errorMsg);
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = async () => {
    if (!selectedCamera) return;
    try {
      await axios.post(`http://localhost:8000/monitor/stop/${selectedCamera}`);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error desconocido al detener.';
      setMonitorError(errorMsg);
    }
  };

  const getSystemInfo = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/cameras/system-info');
      setSystemInfo(response.data);
      setShowSystemInfo(true);
    } catch (error) {
      setMonitorError('Error al obtener info del sistema: ' + error.message);
    }
  }, []);
  // La función de captura de prueba se ha eliminado ya que no es necesaria en la versión final

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-cyan-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-cyan-800">📊 Monitor en Tiempo Real</h1>
        <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{isConnected ? 'Conectado' : 'Desconectado'}</span>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border-l-4 border-purple-500">
        <h2 className="text-xl font-bold text-purple-800 mb-4">🎥 Control de Cámaras</h2>
        <div className="grid md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-purple-700 mb-2">Seleccionar Cámara</label>
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)} className="w-full p-2 border border-purple-300 rounded-md" disabled={isMonitoring || isLoadingData}>
              <option value="">{isLoadingData ? "Cargando..." : "-- Seleccione --"}</option>
              {availableCameras.map((camera) => (
                <option key={camera.camera_id} value={camera.camera_id}>{camera.camera_id} ({camera.tunel})</option>
              ))}
            </select>
          </div>
          <div>
            <button onClick={isMonitoring ? stopMonitoring : startMonitoring} disabled={!selectedCamera || isLoadingData} className={`w-full px-4 py-2 rounded-md font-medium ${!selectedCamera || isLoadingData ? 'bg-gray-300' : isMonitoring ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
              {isMonitoring ? '⏹️ Detener' : '▶️ Iniciar'}
            </button>
          </div>          <div><button onClick={getSystemInfo} className="w-full px-4 py-2 rounded-md font-medium bg-blue-500 text-white hover:bg-blue-600">🔍 Info Cámaras</button></div>
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
          </div>
        </div>
        {monitorError && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md"><strong>Error:</strong> {monitorError}</div>}
      </div>

      <div className="grid md:grid-cols-3 gap-6">        <div className="md:col-span-2 bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Visualización de Cámara</h3>
            <div className="bg-black aspect-video rounded-md flex items-center justify-center text-white">
                {selectedCamera ? (
                    <div className="w-full h-full relative">
                        <img 
                            src={`http://localhost:8000/video/stream/${selectedCamera}?t=${Date.now()}`} 
                            alt="Transmisión en vivo"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                                console.error("Error al cargar el stream de video");
                                setMonitorError("No se pudo cargar la transmisión de video. Asegúrese de que la cámara esté conectada y funcionando correctamente.");
                            }}
                            onLoad={() => {
                                // Limpiar errores cuando la imagen se carga correctamente
                                setMonitorError('');
                            }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                            Cámara: {selectedCamera} | Estado: {isMonitoring ? 'Monitoreando' : 'Solo Vista'} | {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-4">
                        <p className="text-gray-400 mb-2">Ninguna cámara seleccionada.</p>
                        <p className="text-gray-500 text-sm">Seleccione una cámara para ver la transmisión en vivo.</p>
                    </div>
                )}
            </div>
            {monitorError && (
                <div className="mt-2 p-2 bg-red-100 text-red-700 text-sm rounded">
                    <strong>Problema con la cámara:</strong> {monitorError}
                </div>
            )}
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Detecciones Recientes</h3>
          <div className="space-y-3 h-96 overflow-y-auto">
            {recentDetections.length > 0 ? recentDetections.map((det, index) => (
                <div key={det.id || index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="font-bold text-gray-900">N°: {det.numero}</div>
                  <div className="text-sm text-gray-600">Confianza: {(det.confianza * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">{new Date(det.timestamp).toLocaleString()}</div>
                </div>
              )) : <p className="text-sm text-gray-500">Esperando detecciones...</p>
            }
          </div>
        </div>
      </div>

      {debugInfo && (
        <div className="bg-white rounded-lg p-6 mt-6 shadow-sm border-l-4 border-yellow-500">
          <h2 className="text-xl font-bold text-yellow-800 mb-4">🔍 Info de Debug (Backend)</h2>
          <div className="bg-yellow-50 p-4 rounded border grid md:grid-cols-2 gap-4">
              <p><strong>Cámara:</strong> {debugInfo.camera_id}</p>
              <p><strong>FPS:</strong> {debugInfo.fps}</p>
              <p><strong>Resolución:</strong> {debugInfo.resolution}</p>
              <p><strong>Última Actualización:</strong> {new Date(debugInfo.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {showSystemInfo && systemInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSystemInfo(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Información de Cámaras del Sistema</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-blue-700 mb-3">Cámaras Físicas Detectadas</h4>
                <div className="space-y-2">
                  {systemInfo.system_cameras.map((cam, index) => (
                    <div key={index} className="p-3 rounded border bg-blue-50 border-blue-200">
                      <div className="font-medium">Índice: {cam.index} ({cam.status})</div>
                      <div className="text-sm text-gray-600">Resolución: {cam.width}x{cam.height} @ {cam.fps} FPS</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-green-700 mb-3">Configuración Actual</h4>
                <div className="space-y-2">
                  {systemInfo.configured_cameras.map((cam, index) => (
                    <div key={index} className={`p-3 rounded border ${cam.currently_monitoring ? 'bg-green-100 border-green-300' : 'bg-gray-50'}`}>
                      <div className="font-medium flex items-center">{cam.currently_monitoring ? '🟢' : '⚪'} {cam.camera_id}</div>
                      <div className="text-sm text-gray-600">Túnel: {cam.tunel} | Usa Índice: {cam.camera_url}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
              <p><strong>Resumen:</strong> {systemInfo.total_system_cameras} cámara(s) detectada(s) | {systemInfo.active_monitors} monitor(es) activo(s).</p>
            </div>
            <button onClick={() => setShowSystemInfo(false)} className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMonitorNew;
