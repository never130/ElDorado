import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Activity, Video, StopCircle, PlayCircle, Clock, CheckCircle2, XCircle, Search, RefreshCw, AlertCircle, Info, Database, Camera } from 'lucide-react';
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
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Activity className="w-8 h-8 text-orange-600" /> Monitor en Tiempo Real
        </h1>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-orange-600" /> Control de Cámaras
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Cámara</label>
            <select 
              value={selectedCamera} 
              onChange={(e) => setSelectedCamera(e.target.value)} 
              className="input-field" 
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
              className={`w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all duration-200 transform ${
                !selectedCamera || isLoadingData 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                  : isMonitoring 
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-md' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
              }`}
            >
              {isLoadingData ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Cargando...</>
              ) : isMonitoring ? (
                <><StopCircle className="w-5 h-5 mr-2" /> Detener</>
              ) : (
                <><PlayCircle className="w-5 h-5 mr-2" /> Iniciar</>
              )}
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
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
              isMonitoring 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isMonitoring 
                  ? 'bg-emerald-500 animate-pulse' 
                  : 'bg-slate-400'
              }`}></div>
              {isMonitoring ? 'Monitoreando' : 'Detenido'}
            </div>
            {isConnected ? (
              <div className="text-xs text-emerald-600 mt-2 flex items-center justify-center font-medium">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></div>
                WebSocket conectado
              </div>
            ) : (
              <div className="text-xs text-red-600 mt-2 flex items-center justify-center font-medium">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></div>
                WebSocket desconectado
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-sm text-slate-600">
              <div className="font-semibold text-orange-700 text-lg">Detec: {recentDetections.length}</div>
              <div className="text-xs">Últimas en vivo</div>
            </div>
          </div>
        </div>
        {monitorError && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span><strong>Error:</strong> {monitorError}</span>
        </div>}
          {/* Información adicional cuando está monitoreando */}
        {isMonitoring && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-sm text-emerald-800">
                <h4 className="font-semibold mb-1">Monitor Activo - Detección Automática</h4>
                <p className="text-xs opacity-90">
                  El sistema está analizando el video en tiempo real usando IA para detectar números de vagonetas y modelos de ladrillos.
                  Las detecciones se guardan automáticamente en el historial.
                </p>
              </div>
            </div>
            <div className="text-emerald-700 flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-emerald-100 shadow-sm text-sm font-medium">
              <Camera className="w-4 h-4" /> {selectedCamera}
            </div>
          </div>
        )}
      </div>      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div className="card p-4 flex-1">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-orange-600" /> Transmisión en Vivo
            </h3>
            <div className="bg-slate-900 aspect-video rounded-xl flex items-center justify-center text-white relative overflow-hidden shadow-inner">
                {selectedCamera ? (
                    <div className="w-full h-full relative">
                        <img 
                            src={`${API_BASE_URL}/video/stream/${selectedCamera}?t=${Date.now()}`} 
                            alt="Transmisión en vivo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                console.error("Error al cargar el stream de video");
                                setMonitorError("No se pudo cargar la transmisión de video. Inicie el monitoreo para activar la cámara.");
                            }}
                            onLoad={() => {
                                setMonitorError('');
                            }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-4 pt-12">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2 font-medium text-sm">
                                  <Camera className="w-4 h-4" /> {selectedCamera} 
                                  <span className="opacity-50">|</span> 
                                  {isMonitoring ? <span className="text-red-400">EN VIVO</span> : <span className="text-slate-300">VISTA PREVIA</span>}
                                </span>
                                <span className="text-sm font-mono opacity-80 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                        {isMonitoring && (
                            <div className="absolute top-4 right-4 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-xs font-bold animate-pulse flex items-center gap-2 shadow-lg">
                                <div className="w-2 h-2 bg-white rounded-full"></div> GRABANDO
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center p-8 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <Camera className="w-8 h-8 text-slate-500" />
                        </div>
                        <p className="text-slate-300 mb-2 text-lg font-medium">Ninguna cámara seleccionada</p>
                        <p className="text-slate-500 text-sm max-w-sm">Seleccione una cámara e inicie el monitoreo para ver la transmisión en vivo con detección automática</p>
                    </div>
                )}
            </div>
            
            {/* Panel de información de detección activa */}
            {isMonitoring && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                    <Activity className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-semibold text-orange-900 mb-1">Detección Automática Activa</h4>
                        <p className="text-sm text-orange-700 opacity-90">
                            El sistema está analizando el video en tiempo real para detectar números de vagonetas y modelos de ladrillos.
                        </p>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="card p-4 flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-600" /> Recientes
              <span className="bg-slate-100 text-slate-600 text-xs py-0.5 px-2 rounded-full font-medium ml-1">{recentDetections.length}/15</span>
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
                  className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                  title="Reconectar WebSocket"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {recentDetections.length > 0 ? recentDetections.map((det, index) => (
                <div key={`det-${det.id || det._id || index}-${det.timestamp || Date.now()}-${index}`} className={`p-4 rounded-xl border transition-all ${
                  det.origen_deteccion === 'live_camera' 
                    ? 'bg-emerald-50/50 border-emerald-100' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Número</span>
                      <span className="font-bold text-slate-900 text-2xl leading-none">
                        {det.numero_detectado || det.numero || 'N/A'}
                      </span>
                    </div>
                    <div className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border ${
                      det.origen_deteccion === 'live_camera' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {det.origen_deteccion === 'live_camera' ? <Video className="w-3 h-3" /> : <Database className="w-3 h-3" />}
                      {det.origen_deteccion === 'live_camera' ? 'En vivo' : 'Historial'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3 bg-white p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="block text-xs text-slate-500 mb-0.5">Confianza</span>
                      <span className="font-semibold text-emerald-600">
                        {(det.confianza * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500 mb-0.5">Evento</span>
                      <span className="font-semibold text-orange-600 capitalize">
                        {det.evento || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {det.modelo_ladrillo && (
                    <div className="text-sm text-slate-700 font-medium mb-3 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-200 rounded border border-orange-300"></div>
                      <span className="opacity-70">Modelo:</span> {det.modelo_ladrillo}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(det.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </div>
                    {det.imagen_path && (
                      <button
                        onClick={() => window.open(`${API_BASE_URL}/${det.imagen_path}`, '_blank')}
                        className="text-xs text-orange-600 font-medium hover:text-orange-800 flex items-center gap-1"
                      >
                        Ver imagen
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                  <Search className="w-12 h-12 text-slate-400 mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-1">Esperando detecciones</p>
                  <p className="text-sm text-slate-500">
                    {isMonitoring 
                      ? 'El monitoreo está activo. Las detecciones aparecerán aquí.' 
                      : 'Inicia el monitoreo para ver detecciones.'}
                  </p>
                </div>
              )
            }
          </div>
          
          {/* Panel de estadísticas rápidas */}
          {recentDetections.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-xs font-medium px-1">
                <span className="text-slate-500">Total: <span className="text-slate-900">{recentDetections.length}</span></span>
                <span className="text-slate-500">En vivo: <span className="text-emerald-600">{recentDetections.filter(d => d.origen_deteccion === 'live_camera').length}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {debugInfo && (
        <div className="card p-6 mt-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-600" /> Info de Debug (Backend)
          </h2>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg grid md:grid-cols-4 gap-4 text-sm">
              <div><strong className="block text-slate-500 mb-1">Cámara</strong> <span className="font-medium">{debugInfo.camera_id}</span></div>
              <div><strong className="block text-slate-500 mb-1">FPS</strong> <span className="font-medium text-emerald-600">{debugInfo.fps}</span></div>
              <div><strong className="block text-slate-500 mb-1">Resolución</strong> <span className="font-medium font-mono">{debugInfo.resolution}</span></div>
              <div><strong className="block text-slate-500 mb-1">Actualización</strong> <span className="font-medium font-mono">{new Date(debugInfo.timestamp).toLocaleTimeString()}</span></div>
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
