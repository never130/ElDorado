import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL, WS_BASE_URL } from '../config/api';

const RealTimeMonitorNew = () => {
  
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
      const wsUrl = WS_BASE_URL;
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
              timestamp: message.data.timestamp || new Date().toISOString(),
              // Información de estabilización si está disponible
              stability_info: message.data.stability_info || null
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
    if (!selectedCamera) {
      setMonitorError('Por favor seleccione una cámara antes de iniciar el monitoreo.');
      return;
    }
    
    setMonitorError('');
    setDebugInfo(null);
    
    try {
      console.log(`🚀 Iniciando monitoreo para cámara: ${selectedCamera}`);
      const response = await axios.post(`${API_BASE_URL}/monitor/start/${selectedCamera}`);
      setIsMonitoring(true);
      console.log('✅ Monitoreo iniciado exitosamente:', response.data);
      
      // Mostrar mensaje de éxito temporal
      setTimeout(() => {
        if (response.data.message) {
          console.log(`📢 ${response.data.message}`);
        }
      }, 500);
      
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('ya está activo')) {
        // Si ya está activo, simplemente actualizar el estado
        setIsMonitoring(true);
        setMonitorError('');
        console.log('ℹ️ El monitoreo ya estaba activo');
      } else {
        const errorMsg = error.response?.data?.detail || 'Error desconocido al iniciar el monitoreo.';
        setMonitorError(`❌ Error al iniciar: ${errorMsg}`);
        setIsMonitoring(false);
        console.error('❌ Error al iniciar monitoreo:', errorMsg);
      }
    }
  };
  const stopMonitoring = async () => {
    if (!selectedCamera) {
      setMonitorError('No hay cámara seleccionada para detener.');
      return;
    }
    
    try {
      console.log(`🛑 Deteniendo monitoreo para cámara: ${selectedCamera}`);
      await axios.post(`${API_BASE_URL}/monitor/stop/${selectedCamera}`);
      setIsMonitoring(false);
      setMonitorError('');
      console.log('✅ Monitoreo detenido exitosamente');
      
      // Limpiar detecciones en vivo al detener
      setRecentDetections(prev => prev.filter(det => det.origen_deteccion !== 'live_camera'));
      
    } catch (error) {
      if (error.response?.status === 404) {
        // Si ya está detenido, simplemente actualizar el estado
        setIsMonitoring(false);
        setMonitorError('');
        console.log('ℹ️ El monitoreo ya estaba detenido');
      } else {
        const errorMsg = error.response?.data?.detail || 'Error desconocido al detener el monitoreo.';
        setMonitorError(`❌ Error al detener: ${errorMsg}`);
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
    <div className="w-full max-w-7xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">📊 Monitor en Tiempo Real</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">🎥 Control de Cámaras</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Cámara</label>
            <select 
              value={selectedCamera} 
              onChange={(e) => setSelectedCamera(e.target.value)} 
              className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
              disabled={isMonitoring || isLoadingData}
            >
              <option value="">{isLoadingData ? "Cargando..." : "-- Seleccione --"}</option>
              {availableCameras.map((camera) => (
                <option key={camera.camera_id} value={camera.camera_id}>{camera.camera_id} ({camera.tunel})</option>
              ))}
            </select>
          </div>          <div>
            <button 
              onClick={isMonitoring ? stopMonitoring : startMonitoring} 
              disabled={!selectedCamera || isLoadingData} 
              className={`w-full px-4 py-2 rounded-md font-medium transition-all duration-200 transform ${
                !selectedCamera || isLoadingData 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : isMonitoring 
                    ? 'bg-red-500 text-white hover:bg-red-600 hover:scale-105 shadow-lg' 
                    : 'bg-green-500 text-white hover:bg-green-600 hover:scale-105 shadow-lg'
              } ${isMonitoring ? 'animate-pulse' : ''}`}
            >
              {isLoadingData 
                ? '⏳ Cargando...' 
                : isMonitoring 
                  ? '⏹️ Detener' 
                  : '▶️ Iniciar'
              }
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
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all duration-200 ${
              isMonitoring 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : 'bg-gray-100 text-gray-500 border border-gray-300'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isMonitoring 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-gray-400'
              }`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
            {isConnected && (
              <div className="text-xs text-green-600 mt-1 flex items-center justify-center">
                <div className="w-1 h-1 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                WebSocket conectado
              </div>
            )}
            {!isConnected && (
              <div className="text-xs text-red-600 mt-1 flex items-center justify-center">
                <div className="w-1 h-1 bg-red-500 rounded-full mr-1"></div>
                WebSocket desconectado
              </div>
            )}
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
      </div>      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-slate-800 mb-4">📹 Visualización de Cámara en Vivo</h3>
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
                        <p className="text-slate-400 mb-2 text-lg">Ninguna cámara seleccionada</p>
                        <p className="text-slate-500 text-sm">Seleccione una cámara e inicie el monitoreo para ver la transmisión en vivo con detección automática</p>
                    </div>
                )}
            </div>
            {monitorError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                    <strong>⚠️ Problema con la cámara:</strong> {monitorError}
                </div>
            )}
            
            {/* Panel de información de detección activa */}
            {isMonitoring && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-blue-800 mb-1">🤖 Detección Automática Activa</h4>
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
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-slate-800 flex items-center">
              📋 Detecciones Recientes
              <span className="ml-2 text-sm font-normal text-slate-500">({recentDetections.length}/15)</span>
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={loadInitialData}
                className="text-sm px-3 py-1 bg-orange-500 text-white font-medium rounded hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                title="Recargar detecciones del historial"
              >
                🔄 Historial
              </button>
              <button 
                onClick={() => setRecentDetections([])}
                className="text-sm px-2 py-1 bg-slate-200 text-slate-600 font-medium rounded hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                title="Limpiar lista de detecciones"
              >
                🗑️ Limpiar
              </button>
              {!isConnected && (
                <button 
                  onClick={() => {
                    console.log('🔄 Reconectando WebSocket manualmente...');
                    reconnectAttempts.current = 0;
                    connectWebSocket();
                  }}
                  className="text-sm px-2 py-1 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  title="Reconectar WebSocket"
                >
                  🔌 Reconectar
                </button>
              )}
            </div>
          </div>          <div className="space-y-3 h-[600px] overflow-y-auto border border-slate-200 rounded-md p-2">
            {recentDetections.length > 0 ? recentDetections.map((det, index) => (
                <div key={`det-${det.id || det._id || index}-${det.timestamp || Date.now()}-${index}`} className={`p-3 rounded-md border transition-all hover:shadow-sm ${
                  det.origen_deteccion === 'live_camera' 
                    ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-slate-900 text-lg">
                      N°: {det.numero_detectado || det.numero || 'N/A'}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                      det.origen_deteccion === 'live_camera' 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {det.origen_deteccion === 'live_camera' ? '📹 En vivo' : '📋 Historial'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">Confianza:</span>
                      <span className="ml-1 font-bold text-green-600">
                        {(det.confianza * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">Evento:</span>
                      <span className="ml-1 font-medium text-blue-600">
                        {det.evento || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {det.modelo_ladrillo && (
                    <div className="text-sm text-orange-700 font-medium mb-2 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                      🧱 <span className="font-medium">Modelo:</span> {det.modelo_ladrillo}
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 mb-2 flex items-center">
                    <span className="mr-2">🕒</span>
                    {new Date(det.timestamp).toLocaleString()}
                  </div>
                  
                  {det.imagen_path && (
                    <div className="mt-2">
                      <img 
                        src={`${API_BASE_URL}/${det.imagen_path}`}
                        alt={`Detección ${det.id}`}
                        className="w-full h-20 object-cover rounded border border-slate-200 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
                        onClick={() => window.open(`${API_BASE_URL}/${det.imagen_path}`, '_blank')}
                        title="Click para ver imagen completa"
                      />
                      <div className="text-xs text-slate-400 mt-1 text-center">
                        📸 Click para ampliar
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-lg text-slate-500 mb-2">Esperando detecciones...</p>
                  <p className="text-sm text-slate-400 mb-4">
                    {isMonitoring 
                      ? 'El monitoreo está activo. Las detecciones aparecerán aquí en tiempo real.' 
                      : 'Inicia el monitoreo para ver detecciones en tiempo real.'}
                  </p>
                  {!isMonitoring && (
                    <div className="text-xs text-slate-400 bg-slate-100 p-2 rounded">
                      💡 <strong>Tip:</strong> Selecciona una cámara y presiona "▶️ Iniciar" para comenzar
                    </div>
                  )}
                </div>
              )
            }
          </div>
            {/* Panel de estadísticas rápidas */}
          {recentDetections.length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <h4 className="font-medium text-slate-800 mb-2">📊 Resumen Rápido</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-600">Total detecciones:</span>
                  <span className="ml-1 font-bold text-blue-600">{recentDetections.length}</span>
                </div>
                <div>
                  <span className="text-slate-600">En vivo:</span>
                  <span className="ml-1 font-bold text-green-600">
                    {recentDetections.filter(d => d.origen_deteccion === 'live_camera').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>      {debugInfo && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-medium text-slate-800 mb-4">🔍 Info de Debug (Backend)</h2>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded grid md:grid-cols-2 gap-4">
              <p><strong>Cámara:</strong> {debugInfo.camera_id}</p>
              <p><strong>FPS:</strong> {debugInfo.fps}</p>
              <p><strong>Resolución:</strong> {debugInfo.resolution}</p>
              <p><strong>Última Actualización:</strong> {new Date(debugInfo.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {showSystemInfo && systemInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSystemInfo(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-800">📊 Información de Cámaras del Sistema</h2>
              <button 
                onClick={() => setShowSystemInfo(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl font-bold focus:outline-none"
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
                        <div className="text-sm text-slate-600">Resolución: {cam.width}x{cam.height} @ {cam.fps} FPS</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-green-700 mb-3">Configuración Actual</h4>
                  <div className="space-y-2">
                    {systemInfo.configured_cameras.map((cam, index) => (
                      <div key={index} className={`p-3 rounded border ${cam.currently_monitoring ? 'bg-green-100 border-green-300' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="font-medium flex items-center">{cam.currently_monitoring ? '🟢' : '⚪'} {cam.camera_id}</div>
                        <div className="text-sm text-slate-600">Túnel: {cam.tunel} | Usa Índice: {cam.camera_url}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg text-slate-500 mb-2">Información del Sistema</p>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-md text-left">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap">
                    {JSON.stringify(systemInfo, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {systemInfo.total_system_cameras !== undefined && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded">
                <p><strong>Resumen:</strong> {systemInfo.total_system_cameras} cámara(s) detectada(s) | {systemInfo.active_monitors || 0} monitor(es) activo(s).</p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowSystemInfo(false)} 
                className="px-6 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
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
