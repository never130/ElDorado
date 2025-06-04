import React, { useState, useEffect, useRef } from 'react';
import './CameraCapture.css';
import VideoPlayer from './VideoPlayer';

const VideoTrainingMonitor = () => {    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({});
    const [detections, setDetections] = useState([]);
    const intervalRef = useRef(null);    useEffect(() => {        const fetchStatus = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/auto-capture/status');
                const data = await response.json();
                
                setIsRunning(data.status === 'running');
                setStats(data.statistics || {});
                
                // Obtener detecciones recientes
                if (data.status === 'running') {
                    fetchRecentDetections();
                }
            } catch (error) {
                console.error('Error fetching status:', error);
            }
        };

        // Obtener estado inicial
        fetchStatus();
        
        // Actualizar cada 2 segundos cuando está corriendo
        if (isRunning) {
            intervalRef.current = setInterval(fetchStatus, 2000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };    }, [isRunning]);    const fetchRecentDetections = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/vagonetas/?limit=10');
            const data = await response.json();
            setDetections(data.slice(0, 5)); // Últimas 5 detecciones
        } catch (error) {
            console.error('Error fetching detections:', error);
        }
    };    const startTraining = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/auto-capture/start', {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                setIsRunning(true);
                alert('🚀 Sistema de entrenamiento iniciado con video demo');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert(`Error iniciando entrenamiento: ${error.message}`);
        }
    };    const stopTraining = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/auto-capture/stop', {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                setIsRunning(false);
                alert('⏹️ Sistema de entrenamiento detenido');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert(`Error deteniendo entrenamiento: ${error.message}`);
        }
    };

    const getVideoStats = () => {
        const videoStats = stats['video_demo_calados'];
        if (!videoStats) return null;
        
        return {
            frames_processed: videoStats.frames_processed || 0,
            motion_detected: videoStats.motion_detected || 0,
            vagonetas_detected: videoStats.vagonetas_detected || 0,
            false_positives: videoStats.false_positives || 0,
            video_loops: videoStats.video_loops || 0,
            accuracy: videoStats.vagonetas_detected > 0 ? 
                ((videoStats.vagonetas_detected / (videoStats.vagonetas_detected + videoStats.false_positives)) * 100).toFixed(1) : 0
        };
    };

    const videoStats = getVideoStats();

    return (
        <div className="container mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                            🎬 Monitor de Entrenamiento con Video
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Observa cómo el modelo detecta números calados en tiempo real usando el video demo
                        </p>
                    </div>
                    <div className="flex space-x-3">
                        {!isRunning ? (
                            <button
                                onClick={startTraining}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
                            >
                                <span>▶️</span>
                                <span>Iniciar Entrenamiento</span>
                            </button>
                        ) : (
                            <button
                                onClick={stopTraining}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
                            >
                                <span>⏹️</span>
                                <span>Detener</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Estado del Sistema */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className={`p-4 rounded-lg ${isRunning ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'} border`}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-700">Estado</h3>
                            <span className={`text-2xl ${isRunning ? 'animate-pulse' : ''}`}>
                                {isRunning ? '🟢' : '🔴'}
                            </span>
                        </div>
                        <p className={`text-lg font-bold ${isRunning ? 'text-green-700' : 'text-gray-700'}`}>
                            {isRunning ? 'Procesando Video' : 'Detenido'}
                        </p>
                    </div>

                    {videoStats && (
                        <>
                            <div className="p-4 bg-blue-100 border border-blue-300 rounded-lg">
                                <h3 className="font-semibold text-gray-700">Frames Procesados</h3>
                                <p className="text-2xl font-bold text-blue-700">{videoStats.frames_processed}</p>
                                <p className="text-sm text-gray-600">Loops: {videoStats.video_loops}</p>
                            </div>

                            <div className="p-4 bg-purple-100 border border-purple-300 rounded-lg">
                                <h3 className="font-semibold text-gray-700">Movimiento Detectado</h3>
                                <p className="text-2xl font-bold text-purple-700">{videoStats.motion_detected}</p>
                                <p className="text-sm text-gray-600">Activaciones del sensor</p>
                            </div>

                            <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                                <h3 className="font-semibold text-gray-700">Vagonetas Identificadas</h3>
                                <p className="text-2xl font-bold text-yellow-700">{videoStats.vagonetas_detected}</p>
                                <p className="text-sm text-gray-600">Precisión: {videoStats.accuracy}%</p>
                            </div>
                        </>
                    )}
                </div>                {/* Información del Video */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">📹 Video Demo en Tiempo Real</h3>
                    <VideoPlayer 
                        cameraId="video_demo_calados" 
                        isPlaying={isRunning}
                    />
                </div>

                {/* Información del Modelo */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">🤖 Información del Modelo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Archivo:</p>
                            <p className="font-medium">CarroNcalados800.mp4</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Modelo:</p>
                            <p className="font-medium">YOLOv8 NumerosCalados</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Tipo:</p>
                            <p className="font-medium">Números Calados (Embossed)</p>
                        </div>
                    </div>
                </div>

                {/* Detecciones Recientes */}
                <div className="bg-white border rounded-lg">
                    <div className="px-4 py-3 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800">🔍 Detecciones Recientes</h3>
                    </div>
                    <div className="p-4">
                        {detections.length > 0 ? (
                            <div className="space-y-3">
                                {detections.map((detection, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-4">
                                            <span className="text-2xl font-bold text-blue-600">
                                                {detection.numero}
                                            </span>
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {detection.evento} - {detection.tunel}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(detection.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {detection.confidence && (
                                                <p className="text-sm font-medium text-green-600">
                                                    Confianza: {(detection.confidence * 100).toFixed(1)}%
                                                </p>
                                            )}
                                            {detection.auto_captured && (
                                                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                                    Auto
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <span className="text-4xl">🔍</span>
                                <p className="text-gray-500 mt-2">
                                    {isRunning ? 'Procesando video... Las detecciones aparecerán aquí.' : 'Inicia el entrenamiento para ver detecciones'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Instrucciones */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 ¿Cómo funciona?</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>• El sistema procesa el video CarroNcalados800.mp4 en tiempo real</li>
                        <li>• Detecta movimiento y analiza cada frame con el modelo YOLOv8</li>
                        <li>• Identifica números calados en las vagonetas automáticamente</li>
                        <li>• Guarda las detecciones en la base de datos con confianza y metadata</li>
                        <li>• El video se reproduce en loop para demostración continua</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default VideoTrainingMonitor;
