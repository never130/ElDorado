import React, { useState, useEffect, useRef, useCallback } from 'react';

const LiveStreamPlayer = ({ cameraId, isActive = false }) => {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamUrl, setStreamUrl] = useState(null);
    const imgRef = useRef(null);

    const startStreaming = useCallback(() => {
        if (!cameraId) return;
        
        setIsLoading(true);
        setError(null);
        
        const url = `http://127.0.0.1:8000/video/stream/${cameraId}`;
        setStreamUrl(url);
        
        // Configurar manejo de errores de imagen
        if (imgRef.current) {
            imgRef.current.onload = () => {
                setIsLoading(false);
                setError(null);
            };
            
            imgRef.current.onerror = () => {
                setIsLoading(false);
                setError('Error al cargar el stream de video');
            };
        }
    }, [cameraId]);

    const stopStreaming = useCallback(() => {
        setStreamUrl(null);
        setIsLoading(false);
        setError(null);
    }, []);

    useEffect(() => {
        if (isActive && cameraId) {
            startStreaming();
        } else {
            stopStreaming();
        }

        return () => stopStreaming();
    }, [isActive, cameraId, startStreaming, stopStreaming]);

    const retryStream = () => {
        stopStreaming();
        setTimeout(() => {
            if (isActive && cameraId) {
                startStreaming();
            }
        }, 1000);
    };

    const renderPlaceholder = () => (
        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
            <div className="text-center">
                <span className="text-6xl mb-4 block">📹</span>
                <p className="text-lg font-medium">
                    {!cameraId ? 'Seleccione una cámara' 
                     : !isActive ? 'Inicie el monitoreo para ver el stream'
                     : isLoading ? 'Cargando stream...'
                     : 'Stream no disponible'}
                </p>
                {error && (
                    <p className="text-red-500 text-sm mt-2">{error}</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {/* Video Display */}
            <div className="relative bg-black aspect-video">
                {streamUrl && isActive ? (
                    <>
                        <img 
                            ref={imgRef}
                            src={streamUrl}
                            alt="Stream en vivo"
                            className="w-full h-full object-contain"
                            style={{ 
                                display: error ? 'none' : 'block',
                                maxWidth: '100%',
                                height: 'auto'
                            }}
                        />
                        
                        {/* Overlay de estado */}
                        <div className="absolute top-2 left-2 flex gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                isLoading ? 'bg-yellow-500 text-black' 
                                : error ? 'bg-red-500 text-white'
                                : 'bg-green-500 text-white'
                            }`}>
                                {isLoading ? '⏳ Cargando...' 
                                 : error ? '❌ Error'
                                 : '🔴 EN VIVO'}
                            </span>
                            
                            {cameraId && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500 text-white">
                                    📹 {cameraId}
                                </span>
                            )}
                        </div>

                        {/* Botón de retry si hay error */}
                        {error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                                <div className="text-center text-white">
                                    <p className="mb-4">❌ Error en el stream</p>
                                    <button
                                        onClick={retryStream}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    >
                                        🔄 Reintentar
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    renderPlaceholder()
                )}
            </div>

            {/* Info Panel */}
            <div className="p-3 bg-gray-50 border-t">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                            {cameraId ? `📹 ${cameraId}` : 'Sin cámara seleccionada'}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isActive && !error && !isLoading && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Streaming
                            </span>
                        )}
                        
                        {error && (
                            <button
                                onClick={retryStream}
                                className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                            >
                                🔄 Retry
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                    {isActive ? 
                        `Stream: ${streamUrl ? 'Activo' : 'Configurando...'}` :
                        'Stream detenido'
                    }
                </div>
            </div>
        </div>
    );
};

export default LiveStreamPlayer;
