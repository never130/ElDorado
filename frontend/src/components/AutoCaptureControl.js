import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AutoCaptureControl = () => {
  const [status, setStatus] = useState('stopped');
  const [statistics, setStatistics] = useState({});
  const [config, setConfig] = useState({ cameras: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Obtener estado cada 5 segundos
  useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    fetchStatus();
    fetchConfig();
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/auto-capture/status');
      setStatus(response.data.status);
      setStatistics(response.data.statistics || {});
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get('http://localhost:8000/auto-capture/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const startAutoCapture = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/auto-capture/start');
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchStatus();
    } catch (error) {
      setMessage('Error al iniciar captura automática');
      setTimeout(() => setMessage(''), 3000);
    }
    setLoading(false);
  };

  const stopAutoCapture = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/auto-capture/stop');
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchStatus();
    } catch (error) {
      setMessage('Error al detener captura automática');
      setTimeout(() => setMessage(''), 3000);
    }
    setLoading(false);
  };

  const StatusIndicator = ({ status }) => {
    const statusColors = {
      running: 'bg-green-500 animate-pulse',
      stopped: 'bg-red-500',
      error: 'bg-yellow-500'
    };
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-500'}`}></div>
        <span className="font-semibold capitalize">{status}</span>
      </div>
    );
  };

  const CameraCard = ({ camera, stats }) => (
    <div className="bg-white rounded-lg p-4 border border-cyan-200 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-cyan-800">{camera.camera_id}</h4>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          camera.evento === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {camera.evento}
        </span>
      </div>
      
      <div className="text-sm text-cyan-600 mb-2">
        <div>Túnel: {camera.tunel}</div>
        <div>URL: {camera.camera_url}</div>
      </div>
      
      {stats && (
        <div className="bg-cyan-50 rounded p-2 text-xs">
          <div className="grid grid-cols-2 gap-1">
            <div>Frames: {stats.frames_processed}</div>
            <div>Movimientos: {stats.motion_detected}</div>
            <div>Vagonetas: {stats.vagonetas_detected}</div>
            <div>Falsos +: {stats.false_positives}</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-cyan-50 min-h-screen">
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-cyan-800">
            🤖 Sistema de Captura Automática
          </h2>
          <StatusIndicator status={status} />
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`p-3 rounded-lg mb-4 ${
            message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {message}
          </div>
        )}

        {/* Controles principales */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={startAutoCapture}
            disabled={loading || status === 'running'}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 
                     text-white font-bold rounded-xl transition-colors"
          >
            {loading ? '⏳ Iniciando...' : '▶️ Iniciar Captura'}
          </button>
          
          <button
            onClick={stopAutoCapture}
            disabled={loading || status === 'stopped'}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 
                     text-white font-bold rounded-xl transition-colors"
          >
            {loading ? '⏳ Deteniendo...' : '⏹️ Detener Captura'}
          </button>
          
          <button
            onClick={fetchStatus}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white 
                     font-bold rounded-xl transition-colors"
          >
            🔄 Actualizar
          </button>
        </div>

        {/* Información del sistema */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Panel de cámaras */}
          <div>
            <h3 className="text-xl font-bold text-cyan-800 mb-4">
              📹 Cámaras Configuradas ({config.cameras.length})
            </h3>
            <div className="space-y-3">
              {config.cameras.map((camera, index) => (
                <CameraCard 
                  key={index} 
                  camera={camera} 
                  stats={statistics[camera.camera_id]} 
                />
              ))}
            </div>
          </div>

          {/* Panel de estadísticas globales */}
          <div>
            <h3 className="text-xl font-bold text-cyan-800 mb-4">
              📊 Estadísticas en Tiempo Real
            </h3>
            
            {status === 'running' && Object.keys(statistics).length > 0 ? (
              <div className="bg-white border border-cyan-200 rounded-lg p-4">
                {Object.entries(statistics).map(([cameraId, stats]) => (
                  <div key={cameraId} className="mb-4 pb-4 border-b border-cyan-100 last:border-b-0">
                    <h4 className="font-semibold text-cyan-700 mb-2">{cameraId}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Frames procesados:</span>
                        <span className="font-mono">{stats.frames_processed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Movimientos:</span>
                        <span className="font-mono">{stats.motion_detected}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vagonetas detectadas:</span>
                        <span className="font-mono text-green-600">{stats.vagonetas_detected}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Falsos positivos:</span>
                        <span className="font-mono text-orange-600">{stats.false_positives}</span>
                      </div>
                    </div>
                    
                    {/* Indicador de eficiencia */}
                    {stats.motion_detected > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-cyan-600">Eficiencia de detección:</div>
                        <div className="bg-cyan-100 rounded-full h-2 mt-1">
                          <div 
                            className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(stats.vagonetas_detected / stats.motion_detected * 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-cyan-600 mt-1">
                          {Math.round(stats.vagonetas_detected / stats.motion_detected * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-cyan-100 border border-cyan-200 rounded-lg p-6 text-center">
                <div className="text-cyan-600 text-lg mb-2">
                  {status === 'stopped' ? '⏸️' : '⏳'}
                </div>
                <div className="text-cyan-700">
                  {status === 'stopped' 
                    ? 'Sistema detenido. Inicia la captura para ver estadísticas.'
                    : 'Iniciando sistema...'
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ayuda rápida */}
        <div className="mt-8 bg-cyan-50 rounded-lg p-4">
          <h4 className="font-bold text-cyan-800 mb-2">💡 Información del Sistema</h4>
          <div className="text-sm text-cyan-700 space-y-1">
            <div>• El sistema detecta movimiento automáticamente y procesa vagonetas</div>
            <div>• Solo se guardan imágenes cuando se detecta un número de vagoneta válido</div>
            <div>• Usa el modelo NumerosCalados para mayor precisión en números calados</div>
            <div>• Las estadísticas se actualizan en tiempo real cada 5 segundos</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoCaptureControl;
