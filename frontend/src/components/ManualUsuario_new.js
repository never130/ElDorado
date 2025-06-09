import React, { useState } from 'react';

const ManualUsuario = () => {
  const [sectionOpen, setSectionOpen] = useState('como-usar');

  const sections = [
    {
      id: 'como-usar',
      title: '🚀 Cómo Usar el Sistema',
      icon: '🚀',
      content: (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-800 mb-2">📤 Procesar Imágenes</h4>
              <p className="text-blue-700 text-sm">
                Sube fotos o videos de vagonetas. El sistema detectará automáticamente los números 
                calados y registrará la información en la base de datos.
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
              <h4 className="font-semibold text-green-800 mb-2">📡 Monitor en Vivo</h4>
              <p className="text-green-700 text-sm">
                Ve las detecciones en tiempo real, estadísticas del sistema y controla 
                la captura automática de imágenes.
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
              <h4 className="font-semibold text-red-800 mb-2">🛤️ Consultar</h4>
              <p className="text-red-700 text-sm">
                Busca el historial completo de movimientos de cualquier vagoneta 
                específica introduciendo su número.
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
              <h4 className="font-semibold text-orange-800 mb-2">📊 Historial</h4>
              <p className="text-orange-700 text-sm">
                Revisa todas las detecciones registradas con filtros por fecha, 
                túnel, evento y otros criterios.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sistema',
      title: '⚙️ Información del Sistema',
      icon: '⚙️',
      content: (
        <div className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800">🎯 ¿Qué hace este sistema?</h4>
            <p className="text-indigo-700 mt-2">
              Este sistema utiliza inteligencia artificial para detectar automáticamente números 
              en vagonetas de tren, registrando su paso por diferentes túneles y generando 
              reportes de trayectorias completas.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">✅ Características principales:</h4>
              <ul className="list-disc list-inside text-green-700 space-y-1 text-sm">
                <li>Detección automática de números calados</li>
                <li>Procesamiento de video en tiempo real</li>
                <li>Base de datos de trayectorias</li>
                <li>Interfaz web intuitiva</li>
                <li>Reportes y estadísticas</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">🔧 Tecnologías usadas:</h4>
              <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                <li>Frontend: React + Tailwind CSS</li>
                <li>Backend: FastAPI + Python</li>
                <li>IA: YOLOv8 personalizado</li>
                <li>Base de datos: MongoDB</li>
                <li>Video: OpenCV</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'consejos',
      title: '💡 Consejos y Recomendaciones',
      icon: '💡',
      content: (
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <h4 className="font-semibold text-yellow-800 mb-2">📋 Para mejores resultados:</h4>
            <ul className="list-disc list-inside text-yellow-700 space-y-1">
              <li>Usa imágenes con buena iluminación</li>
              <li>Asegúrate de que los números sean visibles</li>
              <li>Los videos deben tener resolución mínima de 640x480</li>
              <li>Evita imágenes borrosas o con mucho movimiento</li>
            </ul>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <h4 className="font-semibold text-green-800 mb-2">⚡ Optimización del sistema:</h4>
            <ul className="list-disc list-inside text-green-700 space-y-1">
              <li>El sistema procesa 1 frame por segundo para mejor rendimiento</li>
              <li>Las detecciones se guardan automáticamente</li>
              <li>Puedes revisar el historial en cualquier momento</li>
              <li>Los datos se mantienen organizados por fecha y túnel</li>
            </ul>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">🚨 Solución de problemas:</h4>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              <li>Si no ves detecciones, verifica que el backend esté corriendo</li>
              <li>Si el video no carga, revisa la conexión del backend</li>
              <li>Si hay errores, consulta los logs en la consola del navegador</li>
              <li>Reinicia el sistema si experimentas problemas de rendimiento</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            📚 Manual de Usuario
            <span className="text-lg font-normal bg-white/20 px-3 py-1 rounded-full">
              Sistema El Dorado
            </span>
          </h1>
          <p className="mt-2 text-indigo-100">
            Guía completa para utilizar el sistema de detección de números calados
          </p>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Sidebar */}
          <div className="lg:w-1/4 bg-gray-50 border-r">
            <nav className="p-4">
              <h2 className="font-semibold text-gray-800 mb-4">📋 Contenido</h2>
              <ul className="space-y-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setSectionOpen(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm ${
                        sectionOpen === section.id
                          ? 'bg-indigo-100 text-indigo-800 border-l-4 border-indigo-500'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-lg">{section.icon}</span>
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Content */}
          <div className="lg:w-3/4 p-6">
            {sections.map((section) => (
              <div
                key={section.id}
                className={`${sectionOpen === section.id ? 'block' : 'hidden'}`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{section.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-800">{section.title}</h2>
                </div>
                {section.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualUsuario;
