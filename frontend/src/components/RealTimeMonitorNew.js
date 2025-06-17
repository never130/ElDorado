import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const RealTimeMonitor = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [videoError, setVideoError] = useState('');  const [isLoadingData, setIsLoadingData] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const videoRef = useRef(null);
  const ws = useRef(null);
  const wsReconnectTimeout = useRef(null);  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingData(true);
      console.log('🔄 Cargando datos iniciales...');
      
      // Cargar cámaras disponibles
      console.log('📡 Solicitando cámaras al backend...');
      const camerasRes = await axios.get('http://localhost:8000/cameras/list');
      console.log('📡 Respuesta de cámaras:', camerasRes.data);
      
      if (camerasRes.data && camerasRes.data.cameras) {
        setAvailableCameras(camerasRes.data.cameras);
        console.log('✅ Cámaras cargadas:', camerasRes.data.cameras.length);
      } else {
        console.error('❌ Formato de respuesta de cámaras inesperado:', camerasRes.data);
        setAvailableCameras([]);
      }
      
      // Cargar historial reciente
      console.log('📡 Solicitando historial al backend...');
      const historialRes = await axios.get('http://localhost:8000/historial/', {
        params: { limit: 10, skip: 0 }
      });
      console.log('📡 Respuesta de historial:', historialRes.data);
      setRecentDetections(historialRes.data);
      
      console.log('✅ Datos iniciales cargados exitosamente');
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      setMonitorError('Error al cargar datos iniciales: ' + error.message);
    } finally {
      setIsLoadingData(false);
    }
  }, []); // Sin dependencias para evitar múltiples ejecuciones

  // Iniciar monitoreo
  const startMonitoring = async () => {
    if (!selectedCamera) {
      setMonitorError('Debe seleccionar una cámara');
      return;
    }

    try {
      setMonitorError('');
      setVideoError('');
      
      console.log('Iniciando monitoreo para cámara:', selectedCamera);
      
      // Primero iniciar el monitoreo en el backend
      const response = await axios.post(`http://localhost:8000/monitor/start/${selectedCamera}`);
      console.log('Respuesta del backend:', response.data);
      
      if (response.data.status === 'started') {
        setIsMonitoring(true);
        console.log('Monitoreo iniciado, isMonitoring:', true);
          // Solo mostrar video en frontend si es una cámara real y el backend está funcionando
        const cameraConfig = availableCameras.find(cam => cam.camera_id === selectedCamera);
        console.log('Configuración de cámara encontrada:', cameraConfig);
        
        if (cameraConfig && cameraConfig.source_type === 'camera') {
          console.log('Es una cámara real - El backend maneja la cámara física');
          // Para cámaras reales, el backend ya maneja el acceso a la cámara
          // El frontend solo muestra el estado pero no accede a getUserMedia
          // para evitar conflictos de acceso exclusivo a la cámara
        } else {
          console.log('No es una cámara real o no se encontró configuración');
        }
      }
    } catch (error) {
      console.error('Error starting monitor:', error);
      setMonitorError(error.response?.data?.detail || 'Error al iniciar el monitoreo');
    }
  };
  // Detener monitoreo
  const stopMonitoring = async () => {
    try {
      setVideoError('');
      
      // Detener video stream
      stopVideoStream();
      
      const response = await axios.post(`http://localhost:8000/monitor/stop/${selectedCamera}`);
      if (response.data.status === 'stopped') {
        setIsMonitoring(false);
      }
    } catch (error) {
      setMonitorError(error.response?.data?.detail || 'Error al detener el monitoreo');
    }
  };// Detener stream de video
  const stopVideoStream = useCallback(() => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoStream]);
  // Iniciar stream de video
  const startVideoStream = useCallback(async () => {
    try {
      console.log('🎥 Iniciando startVideoStream...');
      console.log('Estado actual - videoStream:', !!videoStream, 'videoError:', videoError);
      
      // Detener stream anterior si existe
      stopVideoStream();
      
      console.log('Solicitando acceso a la cámara con getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 960 }
        },
        audio: false 
      });
        console.log('✅ Cámara accedida exitosamente, stream:', stream);
      console.log('Video tracks:', stream.getVideoTracks().length);
      
      setVideoStream(stream);
      setVideoError('');
      
      // Usar setTimeout para asegurar que el elemento esté disponible
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Asignando stream al elemento video...');
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata cargada, intentando reproducir...');
            videoRef.current.play().catch(e => console.error('Error playing video:', e));
          };
        } else {
          console.error('videoRef.current sigue siendo null después del timeout!');
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error accessing camera:', error);
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara en el sistema.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'La cámara está siendo usada por otra aplicación.';
      }
      
      console.log('Setting videoError:', errorMessage);
      setVideoError(errorMessage);
    }
  }, [stopVideoStream, videoError, videoStream]);
  // Obtener información del sistema
  const getSystemInfo = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/cameras/system-info');
      setSystemInfo(response.data);
      setShowSystemInfo(true);
    } catch (error) {
      console.error('Error obteniendo información del sistema:', error);
      setMonitorError('Error al obtener información del sistema: ' + error.message);
    }
  }, []);
  useEffect(() => {
    // Solo cargar una vez al montar el componente
    loadInitialData();

    // WebSocket para recibir detecciones en tiempo real
    const wsUrl = 'ws://localhost:8000/ws/detections';
    let mounted = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectWebSocket = () => {
      // Evitar múltiples conexiones y limitar intentos
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Máximo de intentos de reconexión alcanzado');
        return;
      }
      
      if (ws.current && (ws.current.readyState === WebSocket.CONNECTING || ws.current.readyState === WebSocket.OPEN)) {
        return;
      }

      console.log(`Intentando conectar WebSocket (intento ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        if (mounted) {
          setIsConnected(true);
          reconnectAttempts = 0; // Reset counter on successful connection
          console.log('WebSocket conectado exitosamente');
        }
      };

      ws.current.onmessage = (event) => {
        if (!mounted) return;
        
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'monitor_detection' || message.type === 'new_detection') {
            setRecentDetections(prev => [message.data, ...prev].slice(0, 10));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        if (mounted) {
          setIsConnected(false);
          console.log('WebSocket desconectado:', event.code, event.reason);
          
          // Solo reconectar si no fue un cierre intencional y no hemos excedido los intentos
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            
            if (wsReconnectTimeout.current) {
              clearTimeout(wsReconnectTimeout.current);
            }
            
            wsReconnectTimeout.current = setTimeout(() => {
              if (mounted && (!ws.current || ws.current.readyState === WebSocket.CLOSED)) {
                connectWebSocket();
              }
            }, 5000); // Aumentar delay a 5 segundos
          }
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        // No reconectar inmediatamente en error, esperar al onclose
      };
    };

    connectWebSocket();

    return () => {
      mounted = false;
      
      if (wsReconnectTimeout.current) {
        clearTimeout(wsReconnectTimeout.current);
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting'); // Cierre intencional
        ws.current = null;
      }
      
      stopVideoStream();
    };
  }, [loadInitialData, stopVideoStream]); // Dependencias necesarias

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
        
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-purple-700 mb-2">
              Seleccionar Cámara
            </label>            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full p-2 border border-purple-300 rounded-md"
              disabled={isMonitoring || isLoadingData}
            >
              <option value="">
                {isLoadingData ? "⏳ Cargando cámaras..." : "-- Seleccione una cámara --"}
              </option>              {console.log('🎛️ Renderizando cámaras disponibles:', availableCameras.length)}
              {availableCameras.map((camera, index) => (
                <option key={camera.camera_id || index} value={camera.camera_id}>
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
          
          <div>
            <button
              onClick={getSystemInfo}
              className="w-full px-4 py-2 rounded-md font-medium bg-blue-500 text-white hover:bg-blue-600"
            >
              🔍 Info Cámaras
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
        </div>        {monitorError && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md flex justify-between items-center">
            <span>{monitorError}</span>
            <button
              onClick={() => {
                setMonitorError('');
                loadInitialData();
              }}
              className="ml-4 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              🔄 Reintentar
            </button>
          </div>
        )}
        
        {videoError && (
          <div className="mt-4 p-3 bg-yellow-100 text-yellow-700 rounded-md">
            {videoError}
          </div>
        )}
        
        {availableCameras.length === 0 && !isLoadingData && !monitorError && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-md flex justify-between items-center">
            <span>⚠️ No se pudieron cargar las cámaras disponibles</span>
            <button
              onClick={loadInitialData}
              className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              🔄 Recargar
            </button>
          </div>
        )}
      </div>      {/* Video en Vivo */}
      {isMonitoring && selectedCamera && (
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-cyan-800 mb-4">
            📹 Video en Vivo - {selectedCamera}
          </h2>
            <div className="flex justify-center">
            <div className="relative bg-black rounded-lg overflow-hidden max-w-2xl w-full">
              {videoStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-96 object-contain"
                  style={{ aspectRatio: '4/3' }}
                />
              ) : videoError ? (
                <div className="w-full h-64 flex items-center justify-center bg-red-900">
                  <div className="text-center text-white">
                    <div className="text-4xl mb-2">⚠️</div>
                    <div className="mb-2">Error de Cámara Frontend</div>
                    <div className="text-sm">{videoError}</div>
                    <div className="text-xs mt-2">El análisis IA continúa en segundo plano</div>
                  </div>
                </div>              ) : (
                <div className="w-full h-64 flex items-center justify-center bg-gray-800">
                  <div className="text-center text-white">
                    <div className="text-4xl mb-2">🎥</div>
                    <div>Cámara Activa</div>
                    <div className="text-sm mt-1">
                      El backend está procesando la cámara en tiempo real
                    </div>
                    <div className="text-xs mt-2">
                      📡 Backend: ✅ Monitoreando | 🔍 IA: Analizando frames
                    </div>
                  </div>
                </div>
              )}
              
              {/* Overlay de estado */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                {isMonitoring ? (
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                    EN VIVO
                  </span>
                ) : (
                  'DETENIDO'
                )}
              </div>
              
              {/* Overlay de resolución */}
              {videoStream && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  AI: 960x1280
                </div>
              )}
            </div>
          </div>
            <div className="mt-4 text-center text-sm text-gray-600">
            💡 <strong>Información:</strong> Para cámaras reales, el backend procesa el video directamente 
            para evitar conflictos de acceso. Las detecciones aparecen automáticamente en el historial.
          </div>
          
          {videoError && (
            <div className="mt-4 text-center">
              <button
                onClick={startVideoStream}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                🔄 Reintentar Video
              </button>
            </div>
          )}
          
          {!videoStream && !videoError && isMonitoring && (
            <div className="mt-2 text-center text-green-600 text-sm">
              ✅ Monitoreo activo - El sistema está analizando la cámara en segundo plano
            </div>
          )}
        </div>
      )}

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
      
      {/* Modal de Información del Sistema */}
      {showSystemInfo && systemInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-blue-800">🔍 Información de Cámaras del Sistema</h3>
              <button
                onClick={() => setShowSystemInfo(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Cámaras del Sistema */}
              <div>
                <h4 className="font-bold text-green-700 mb-3">📹 Cámaras Detectadas en el Sistema</h4>
                {systemInfo.system_cameras && systemInfo.system_cameras.length > 0 ? (
                  <div className="space-y-2">
                    {systemInfo.system_cameras.map((cam, index) => (
                      <div key={index} className="bg-green-50 p-3 rounded border">
                        <div className="font-medium">📷 Cámara {cam.index}</div>
                        <div className="text-sm text-gray-600">
                          Resolución: {cam.width}x{cam.height} | FPS: {cam.fps}
                        </div>
                        <div className="text-xs text-green-600">Estado: {cam.status}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-600">❌ No se detectaron cámaras en el sistema</div>
                )}
              </div>
              
              {/* Configuración Actual */}
              <div>
                <h4 className="font-bold text-blue-700 mb-3">⚙️ Configuración Actual</h4>
                <div className="space-y-2">
                  {systemInfo.configured_cameras.map((cam, index) => (
                    <div key={index} className={`p-3 rounded border ${cam.currently_monitoring ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                      <div className="font-medium flex items-center">
                        {cam.currently_monitoring ? '🟢' : '⚪'} {cam.camera_id}
                      </div>
                      <div className="text-sm text-gray-600">
                        Túnel: {cam.tunel} | Índice: {cam.camera_url}
                      </div>
                      <div className="text-xs">
                        Tipo: {cam.source_type} | Demo: {cam.demo_mode ? 'Sí' : 'No'}
                      </div>
                      {cam.currently_monitoring && (
                        <div className="text-xs text-blue-600 font-medium">✅ Actualmente monitoreando</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
              <div className="text-sm">
                <strong>📊 Resumen:</strong> {systemInfo.total_system_cameras} cámara(s) detectada(s) | {systemInfo.active_monitors} monitor(es) activo(s)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                💡 <strong>cam_ingreso_1</strong> usa la cámara con <strong>índice {systemInfo.configured_cameras.find(c => c.camera_id === 'cam_ingreso_1')?.camera_url}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMonitor;
