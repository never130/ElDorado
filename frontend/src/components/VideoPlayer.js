import React, { useState, useEffect, useRef } from 'react';

const VideoPlayer = ({ cameraId = 'video_demo_calados', isPlaying = false }) => {
    const [videoInfo, setVideoInfo] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        // Obtener información del video al montar
        fetchVideoInfo();
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [cameraId]);

    useEffect(() => {
        // Controlar streaming según el estado de reproducción
        if (isPlaying) {
            startFrameUpdates();
        } else {
            stopFrameUpdates();
        }

        return () => stopFrameUpdates();
    }, [isPlaying, cameraId]);    const fetchVideoInfo = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/video/info/${cameraId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                setVideoInfo(data.video_info);
                setError(null);
            } else {
                setError('Error obteniendo información del video');
            }
        } catch (err) {
            setError('Error conectando con el servidor');
            console.error('Error fetching video info:', err);
        } finally {
            setLoading(false);
        }
    };    const fetchCurrentFrame = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/video/frame/${cameraId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                setCurrentFrame(data.frame);
                setError(null);
            } else {
                setError('Error obteniendo frame del video');
            }
        } catch (err) {
            setError('Error obteniendo frame');
            console.error('Error fetching frame:', err);
        }
    };

    const startFrameUpdates = () => {
        // Obtener frame inicial
        fetchCurrentFrame();
        
        // Actualizar frames cada 333ms (~3 FPS para reducir carga)
        intervalRef.current = setInterval(fetchCurrentFrame, 333);
    };

    const stopFrameUpdates = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando video...</p>
                </div>
            </div>
        );
    }

    if (error && !videoInfo) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="text-center">
                    <span className="text-4xl">❌</span>
                    <p className="text-red-600 mt-2">{error}</p>
                    <button 
                        onClick={fetchVideoInfo}
                        className="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Video Display */}
            <div className="relative bg-black aspect-video">
                {currentFrame ? (
                    <img 
                        src={currentFrame} 
                        alt="Video frame"
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                        <div className="text-center">
                            <span className="text-6xl">🎬</span>
                            <p className="mt-2">
                                {isPlaying ? 'Cargando video...' : 'Video en pausa'}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Overlay de estado */}
                <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                        isPlaying ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                    }`}>
                        {isPlaying ? '▶️ PROCESANDO' : '⏸️ DETENIDO'}
                    </span>
                </div>

                {/* Indicador de demo */}
                {videoInfo?.demo_mode && (
                    <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500 text-black">
                            🎬 DEMO
                        </span>
                    </div>
                )}
            </div>

            {/* Video Info Panel */}
            <div className="p-4 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-gray-600">Fuente:</p>
                        <p className="font-medium">{videoInfo?.source_type === 'video' ? '📹 Video' : '📷 Cámara'}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Estado:</p>
                        <p className="font-medium">{videoInfo?.is_active ? '🟢 Activo' : '🔴 Inactivo'}</p>
                    </div>
                    {videoInfo?.total_frames && (
                        <div>
                            <p className="text-gray-600">Progreso:</p>
                            <p className="font-medium">
                                {videoInfo.frame_count || 0} / {videoInfo.total_frames}
                            </p>
                        </div>
                    )}
                    {videoInfo?.duration_seconds && (
                        <div>
                            <p className="text-gray-600">Duración:</p>
                            <p className="font-medium">{formatDuration(videoInfo.duration_seconds)}</p>
                        </div>
                    )}
                </div>
                
                {videoInfo?.evento && videoInfo?.tunel && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            <span className="font-medium">{videoInfo.evento}</span> - {videoInfo.tunel}
                        </p>
                    </div>
                )}
            </div>

            {/* Error overlay */}
            {error && currentFrame && (
                <div className="p-2 bg-yellow-50 border-t border-yellow-200">
                    <p className="text-yellow-700 text-xs">⚠️ {error}</p>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
