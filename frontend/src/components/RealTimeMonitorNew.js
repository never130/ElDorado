import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const RealTimeMonitorNew = () => {
  // API Base URL configuration
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  const [recentDetections, setRecentDetections] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);  const [systemInfo, setSystemInfo] = useState(null);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const pingIntervalRef = useRef(null);
  const ws = useRef(null);
  const wsReconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const connectWebSocket = useCallback(() => {
    // Cerrar conexión existente si está abierta
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket ya está conectado');
      return;
    }
    
    // Limpiar conexión anterior si existe
    if (ws.current) {
      ws.current.close(1000, 'Reconnecting');
    }
    
    try {      console.log('🔌 Intentando conectar WebSocket...');
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/detections';
      console.log('🔌 Conectando a:', wsUrl);
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('🔌✅ WebSocket conectado exitosamente');
        setIsConnected(true);
        reconnectAttempts.current = 0; // Resetear contador de intentos
        // Limpiar timeout de reconexión si existe
        if (wsReconnectTimeout.current) {
          clearTimeout(wsReconnectTimeout.current);
          wsReconnectTimeout.current = null;
        }
        
        // Iniciar ping periódico para mantener la conexión activa
        const interval = setInterval(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log('📍 Enviando ping al WebSocket...');
            ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }        }, 30000); // Ping cada 30 segundos
        pingIntervalRef.current = interval;
      };ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('🔔 WS Message recibido:', message);
        
        switch (message.type) {
          case 'new_detection':
            console.log('🎯 Nueva detección recibida:', message.data);
            // Asegurar que el formato sea consistente con el historial
            const detectionData = {
              ...message.data,
              numero_detectado: message.data.numero_detectado || message.data.numero,
              numero: message.data.numero || message.data.numero_detectado,
              // Agregar timestamp si no existe
              timestamp: message.data.timestamp || new Date().toISOString()
            };
            setRecentDetections(prev => {
              // Evitar duplicados basados en ID
              const existingIds = prev.map(d => d.id || d._id).filter(Boolean);
              if (detectionData.id && existingIds.includes(detectionData.id)) {
                return prev;
              }
              return [detectionData, ...prev].slice(0, 15);
            });
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
            break;          case 'connection_established':
            console.log('✅ Conexión WebSocket establecida:', message.message);
            break;
          case 'pong':
            console.log('🏓 Pong recibido del servidor:', message.server_time);
            break;
          case 'echo':
            console.log('📣 Echo recibido:', message);
            break;
          default:
            console.log('ℹ️ Mensaje WebSocket no manejado:', message.type);
            break;
        }      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error, event.data);
      }
    };
    
    ws.current.onerror = (error) => {
      console.error('🔌❌ WebSocket error occurred:', {
        readyState: ws.current?.readyState,
        url: ws.current?.url,
        error: error
      });
      setIsConnected(false);
      // No intentar reconectar inmediatamente en caso de error
    };
    
    ws.current.onclose = (event) => {
      setIsConnected(false);
      console.log('🔌❌ WebSocket desconectado:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean      });
        // Solo reconectar si no fue un cierre intencional (código 1000)
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000); // Backoff exponencial
        console.log(`🔄 Intento de reconexión ${reconnectAttempts.current}/${maxReconnectAttempts} en ${delay}ms...`);
        if (wsReconnectTimeout.current) clearTimeout(wsReconnectTimeout.current);
        wsReconnectTimeout.current = setTimeout(connectWebSocket, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('🔌❌ Máximo número de intentos de reconexión alcanzado');
        setIsConnected(false);
      }
    };
      } catch (error) {
      console.error('🔌❌ Error al crear WebSocket:', error);
      setIsConnected(false);
      // Intentar reconectar en caso de error de creación si no hemos excedido el límite
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
        if (wsReconnectTimeout.current) clearTimeout(wsReconnectTimeout.current);
        wsReconnectTimeout.current = setTimeout(connectWebSocket, delay);
      }
    }
  }, []);  const loadInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const camerasRes = await axios.get(`${API_BASE_URL}/cameras/list`);
      // Asegurarse de que estamos accediendo a cameras.cameras (el array dentro del objeto)
      const camerasArray = camerasRes.data && camerasRes.data.cameras ? camerasRes.data.cameras : [];
      setAvailableCameras(camerasArray);
      console.log('📸 Cámaras cargadas:', camerasArray);
      
      if (camerasArray.length > 0) {
        setSelectedCamera(camerasArray[0].camera_id);
      }
      
      // Cargar detecciones recientes del historial (solo las primeras 10)
      const historyRes = await axios.get(`${API_BASE_URL}/historial/?limit=10`);
      const historialDetections = historyRes.data.registros || [];
      
      // Mezclar con las detecciones en vivo ya existentes (si las hay)
      setRecentDetections(prev => {
        const liveDetections = prev.filter(det => det.origen_deteccion === 'live_camera');
        const combinedDetections = [...liveDetections, ...historialDetections];
        // Ordenar por timestamp (más recientes primero) y tomar solo las primeras 15
        return combinedDetections
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 15);
      });
      
      console.log('📊 Detecciones del historial cargadas:', historialDetections.length);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      setMonitorError('No se pudo conectar con el backend. Verifique que esté en ejecución.');    } finally {
      setIsLoadingData(false);
    }
  }, [API_BASE_URL]);useEffect(() => {
    loadInitialData();
    connectWebSocket();    return () => {
      // Cleanup function to prevent memory leaks and connection issues
      console.log('🧹 Cleanup: Component unmounting');
      
      // Close WebSocket connection
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
        ws.current = null;
      }
      
      // Clear timeouts and intervals
      if (wsReconnectTimeout.current) {
        clearTimeout(wsReconnectTimeout.current);
        wsReconnectTimeout.current = null;
      }
        if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Reset reconnection attempts
      reconnectAttempts.current = 0;
    };
  }, [loadInitialData, connectWebSocket]); // Removed pingInterval dependency to prevent loop
  const startMonitoring = async () => {
    if (!selectedCamera) return;
    setMonitorError('');
    setDebugInfo(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/monitor/start/${selectedCamera}`);
      setIsMonitoring(true);
      console.log('✅ Monitoreo iniciado exitosamente:', response.data);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('ya está activo')) {
        // Si ya está activo, simplemente actualizar el estado
        setIsMonitoring(true);
        setMonitorError('');
        console.log('ℹ️ El monitoreo ya estaba activo');
      } else {
        const errorMsg = error.response?.data?.detail || 'Error desconocido al iniciar.';
        setMonitorError(errorMsg);
        setIsMonitoring(false);
        console.error('❌ Error al iniciar monitoreo:', errorMsg);
      }
    }
  };
  const stopMonitoring = async () => {
    if (!selectedCamera) return;
    try {
      await axios.post(`${API_BASE_URL}/monitor/stop/${selectedCamera}`);
      setIsMonitoring(false);
      setMonitorError('');
      console.log('✅ Monitoreo detenido exitosamente');
    } catch (error) {
      if (error.response?.status === 404) {
        // Si ya está detenido, simplemente actualizar el estado
        setIsMonitoring(false);
        setMonitorError('');
        console.log('ℹ️ El monitoreo ya estaba detenido');
      } else {
        const errorMsg = error.response?.data?.detail || 'Error desconocido al detener.';
        setMonitorError(errorMsg);
        console.error('❌ Error al detener monitoreo:', errorMsg);
      }
    }
  };
  // eslint-disable-next-line no-unused-vars
  const getSystemInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cameras/system-info`);
      setSystemInfo(response.data);
      setShowSystemInfo(true);
      console.log('📊 Info del sistema obtenida:', response.data);
    } catch (error) {
      console.error('❌ Error al obtener info del sistema:', error);
      // Intentar con endpoint alternativo si el primero falla
      try {
        const altResponse = await axios.get(`${API_BASE_URL}/cameras/info`);
        setSystemInfo(altResponse.data);
        setShowSystemInfo(true);
        console.log('📊 Info del sistema obtenida (endpoint alternativo):', altResponse.data);
      } catch (altError) {
        setMonitorError('Error al obtener info del sistema. Endpoint no disponible.');
        console.error('❌ Error en endpoint alternativo:', altError);      }
    }
  }, [API_BASE_URL]);  // eslint-disable-next-line no-unused-vars
  const checkWebSocketStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/websocket/status`);
      console.log('📊 Estado WebSocket:', response.data);
      alert(`WebSocket Status:\nConexiones activas: ${response.data.active_connections}\nDetalles: ${JSON.stringify(response.data.connections_details, null, 2)}`);
    } catch (error) {
      console.error('Error verificando WebSocket:', error);
      alert('Error verificando estado del WebSocket');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const forceReconnectWebSocket = () => {
    console.log('🔄 Forzando reconexión WebSocket...');
    if (ws.current) {
      ws.current.close(1000, 'Force reconnect');
    }
    reconnectAttempts.current = 0;
    setTimeout(connectWebSocket, 1000);  };

  // eslint-disable-next-line no-unused-vars
  const checkMonitorStatus = async () => {    try {
      const response = await axios.get(`${API_BASE_URL}/monitor/status`);
      const activeMonitors = response.data.active_monitors || [];
      const isWebcamActive = activeMonitors.some(m => m.camera_id === selectedCamera);
      setIsMonitoring(isWebcamActive);
      console.log('📊 Estado del monitor actualizado:', response.data);
      
      // Mostrar información del estado
      const totalActive = activeMonitors.length;
      const message = `Estado actualizado: ${totalActive} monitor(es) activo(s). ${isWebcamActive ? `Cámara ${selectedCamera} está activa.` : `Cámara ${selectedCamera} está inactiva.`}`;
      
      // Mostrar mensaje temporal
      setMonitorError('');
      alert(message);
    } catch (error) {
      console.error('❌ Error al verificar estado del monitor:', error);
      setMonitorError('Error al verificar estado del monitor');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-cyan-50 min-h-screen">      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-cyan-800">📊 Monitor en Tiempo Real</h1>
        {/* Indicadores de WebSocket ocultos por petición del usuario */}
        {/*
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => {
              reconnectAttempts.current = 0; // Resetear contador
              connectWebSocket();
            }}
            className={`px-3 py-1 rounded text-sm ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
            title={isConnected ? "Conexión WebSocket activa" : "Hacer click para reconectar WebSocket"}
          >
            {isConnected ? '🟢 Conectado' : reconnectAttempts.current >= maxReconnectAttempts ? '🔴 Reconectar' : '🟡 Conectando...'}
          </button>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {isConnected 
                ? 'WebSocket Activo' 
                : reconnectAttempts.current >= maxReconnectAttempts 
                  ? 'WebSocket Desconectado (Click para reconectar)' 
                  : 'WebSocket Conectando...'
              }
            </span>
            <div className={`w-3 h-3 rounded-full ${
              isConnected 
                ? 'bg-green-500 animate-pulse' 
                : reconnectAttempts.current >= maxReconnectAttempts 
                  ? 'bg-red-500' 
                  : 'bg-yellow-500 animate-pulse'
            }`}></div>
          </div>
        </div>
        */}
      </div><div className="bg-white rounded-lg p-6 mb-6 shadow-sm border-l-4 border-purple-500">
        <h2 className="text-xl font-bold text-purple-800 mb-4">🎥 Control de Cámaras</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-purple-700 mb-2">Seleccionar Cámara</label>
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)} className="w-full p-2 border border-purple-300 rounded-md" disabled={isMonitoring || isLoadingData}>
              <option value="">{isLoadingData ? "Cargando..." : "-- Seleccione --"}</option>
              {availableCameras.map((camera) => (
                <option key={camera.camera_id} value={camera.camera_id}>{camera.camera_id} ({camera.tunel})</option>
              ))}
            </select>
          </div>          <div>
            <button onClick={isMonitoring ? stopMonitoring : startMonitoring} disabled={!selectedCamera || isLoadingData} className={`w-full px-4 py-2 rounded-md font-medium ${!selectedCamera || isLoadingData ? 'bg-gray-300' : isMonitoring ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
              {isMonitoring ? '⏹️ Detener' : '▶️ Iniciar'}
            </button>
          </div>
          {/* Botones ocultos por petición del usuario */}
          {/*
          <div>
            <button onClick={getSystemInfo} className="w-full px-4 py-2 rounded-md font-medium bg-blue-500 text-white hover:bg-blue-600">🔍 Info Cámaras</button>
          </div>
          <div>
            <button onClick={checkMonitorStatus} className="w-full px-4 py-2 rounded-md font-medium bg-purple-500 text-white hover:bg-purple-600">📊 Estado</button>
          </div>
          <div>
            <button onClick={checkWebSocketStatus} className="w-full px-4 py-2 rounded-md font-medium bg-orange-500 text-white hover:bg-orange-600">🔌 WebSocket</button>
          </div>
          <div>
            <button onClick={forceReconnectWebSocket} className="w-full px-4 py-2 rounded-md font-medium bg-yellow-500 text-white hover:bg-yellow-600">🔄 Reconectar</button>
          </div>
          */}
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">
              <div className="font-semibold text-cyan-700">Detecciones: {recentDetections.length}</div>
              <div className="text-xs">Últimas en vivo</div>
            </div>
          </div>
        </div>
        {monitorError && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md"><strong>Error:</strong> {monitorError}</div>}
          {/* Información adicional cuando está monitoreando */}
        {isMonitoring && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="text-sm text-green-800">
                <h4 className="font-semibold mb-1">✅ Monitor Activo - Detección Automática</h4>
                <p className="text-xs">
                  🤖 El sistema está analizando el video en tiempo real usando IA para detectar números de vagonetas y modelos de ladrillos.
                  Las detecciones se guardan automáticamente en el historial con la misma información que las detecciones manuales.
                </p>
              </div>
              <div className="text-green-600 flex flex-col items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mb-1"></div>
                <span className="text-xs">Cámara: {selectedCamera}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">        <div className="xl:col-span-2 bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📹 Visualización de Cámara en Vivo</h3>
            <div className="bg-black aspect-video rounded-md flex items-center justify-center text-white relative">
                {selectedCamera ? (
                    <div className="w-full h-full relative">
                        <img 
                            src={`${API_BASE_URL}/video/stream/${selectedCamera}?t=${Date.now()}`} 
                            alt="Transmisión en vivo"
                            className="w-full h-full object-cover rounded-md"
                            onError={(e) => {
                                console.error("Error al cargar el stream de video");
                                setMonitorError("No se pudo cargar la transmisión de video. Inicie el monitoreo para activar la cámara.");
                            }}
                            onLoad={() => {
                                // Limpiar errores cuando la imagen se carga correctamente
                                setMonitorError('');
                            }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white text-xs p-3">
                            <div className="flex justify-between items-center">
                                <span>📹 {selectedCamera} | {isMonitoring ? '🔴 EN VIVO' : '⚪ VISTA PREVIA'}</span>
                                <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                        {isMonitoring && (
                            <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
                                🔴 GRABANDO
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center p-8">
                        <div className="text-6xl mb-4">📹</div>
                        <p className="text-gray-400 mb-2 text-lg">Ninguna cámara seleccionada</p>
                        <p className="text-gray-500 text-sm">Seleccione una cámara e inicie el monitoreo para ver la transmisión en vivo con detección automática</p>
                    </div>
                )}
            </div>
            {monitorError && (
                <div className="mt-3 p-3 bg-red-100 text-red-700 text-sm rounded-md border border-red-200">
                    <strong>⚠️ Problema con la cámara:</strong> {monitorError}
                </div>
            )}
            
            {/* Panel de información de detección activa */}
            {isMonitoring && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-blue-800 mb-1">🤖 Detección Automática Activa</h4>
                            <p className="text-sm text-blue-600">
                                El sistema está analizando el video en tiempo real para detectar números de vagonetas y modelos de ladrillos.
                                Las detecciones se guardan automáticamente en el historial.
                            </p>
                        </div>
                        <div className="text-blue-600">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                </div>
            )}
        </div><div className="bg-white rounded-lg p-4 shadow-sm">          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              📋 Detecciones Recientes
              <span className="ml-2 text-sm font-normal text-gray-500">({recentDetections.length}/15)</span>
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={loadInitialData}
                className="text-sm px-3 py-1 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-all"
                title="Recargar detecciones del historial"
              >
                🔄 Historial
              </button>
              <button 
                onClick={() => setRecentDetections([])}
                className="text-sm px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-all"
                title="Limpiar lista de detecciones"
              >
                🗑️ Limpiar
              </button>
            </div>
          </div>
          <div className="space-y-3 h-[600px] overflow-y-auto border border-gray-200 rounded-md p-2">            {recentDetections.length > 0 ? recentDetections.map((det, index) => (
                <div key={`det-${det.id || det._id || index}-${det.timestamp || Date.now()}-${index}`} className={`p-3 rounded-md border transition-all hover:shadow-md ${
                  det.origen_deteccion === 'live_camera' 
                    ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900 text-lg">
                      N°: {det.numero_detectado || det.numero || 'N/A'}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                      det.origen_deteccion === 'live_camera' 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {det.origen_deteccion === 'live_camera' ? '📹 En vivo' : '📋 Historial'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div className="text-gray-600">
                      <span className="font-medium text-purple-700">Confianza:</span>
                      <span className="ml-1 font-bold text-green-600">
                        {(det.confianza * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-medium text-purple-700">Evento:</span>
                      <span className="ml-1 font-semibold text-blue-600">
                        {det.evento || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {det.modelo_ladrillo && (
                    <div className="text-sm text-orange-700 font-semibold mb-2 bg-orange-50 px-2 py-1 rounded">
                      🧱 <span className="font-medium">Modelo:</span> {det.modelo_ladrillo}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mb-2 flex items-center">
                    <span className="mr-2">🕒</span>
                    {new Date(det.timestamp).toLocaleString()}
                  </div>
                  
                  {det.imagen_path && (
                    <div className="mt-2">                      <img 
                        src={`${API_BASE_URL}/${det.imagen_path}`}
                        alt={`Detección ${det.id}`}
                        className="w-full h-20 object-cover rounded border cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                        onClick={() => window.open(`${API_BASE_URL}/${det.imagen_path}`, '_blank')}
                        title="Click para ver imagen completa"
                      />
                      <div className="text-xs text-gray-400 mt-1 text-center">
                        📸 Click para ampliar
                      </div>
                    </div>
                  )}
                </div>              )) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-lg text-gray-500 mb-2">Esperando detecciones...</p>
                  <p className="text-sm text-gray-400 mb-4">
                    {isMonitoring 
                      ? 'El monitoreo está activo. Las detecciones aparecerán aquí en tiempo real.' 
                      : 'Inicia el monitoreo para ver detecciones en tiempo real.'}
                  </p>
                  {!isMonitoring && (
                    <div className="text-xs text-gray-400 bg-gray-100 p-2 rounded">
                      💡 <strong>Tip:</strong> Selecciona una cámara y presiona "▶️ Iniciar" para comenzar
                    </div>
                  )}                </div>
              )
            }
          </div>
          
          {/* Panel de estadísticas rápidas */}
          {recentDetections.length > 0 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-md">
              <h4 className="font-semibold text-blue-800 mb-2">📊 Resumen Rápido</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Total detecciones:</span>
                  <span className="ml-1 font-bold text-blue-600">{recentDetections.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">En vivo:</span>
                  <span className="ml-1 font-bold text-green-600">
                    {recentDetections.filter(d => d.origen_deteccion === 'live_camera').length}
                  </span>
                </div>
              </div>
            </div>
          )}
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
      )}      {showSystemInfo && systemInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSystemInfo(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">📊 Información de Cámaras del Sistema</h2>
              <button 
                onClick={() => setShowSystemInfo(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {systemInfo.system_cameras ? (
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
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg text-gray-500 mb-2">Información del Sistema</p>
                <div className="bg-gray-50 p-4 rounded-md text-left">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(systemInfo, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {systemInfo.total_system_cameras !== undefined && (
              <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
                <p><strong>Resumen:</strong> {systemInfo.total_system_cameras} cámara(s) detectada(s) | {systemInfo.active_monitors || 0} monitor(es) activo(s).</p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowSystemInfo(false)} 
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMonitorNew;
