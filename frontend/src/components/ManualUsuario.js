import React, { useState } from 'react';

const ManualUsuario = () => {
  const [sectionOpen, setSectionOpen] = useState('introduccion');

  const sections = [
    {
      id: 'introduccion',
      title: '📖 Introducción',
      icon: '🚀',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">¡Bienvenido al Sistema de Detección de Números Calados!</h3>
          <p className="text-gray-700 leading-relaxed">
            Este sistema utiliza inteligencia artificial avanzada (YOLO) para detectar automáticamente números calados 
            en vagonetas de carga. El sistema procesa video en tiempo real y registra automáticamente cada detección 
            en la base de datos.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <h4 className="font-semibold text-blue-800">🎯 Objetivos del Sistema:</h4>
            <ul className="list-disc list-inside text-blue-700 mt-2 space-y-1">
              <li>Detectar automáticamente números calados en vagonetas</li>
              <li>Procesar video en tiempo real</li>
              <li>Registrar detecciones en base de datos MongoDB</li>
              <li>Mostrar estadísticas y historial de detecciones</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'video-demo',
      title: '🎬 Video Demo',
      icon: '📹',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">Cómo usar el Video Demo</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">🟢 Lo que verás:</h4>
              <ul className="list-disc list-inside text-green-700 space-y-1">
                <li>Video en tiempo real del archivo CarroNcalados800.mp4</li>
                <li>Detecciones automáticas de números calados</li>
                <li>Estadísticas de procesamiento en vivo</li>
                <li>Información del modelo YOLO activo</li>
              </ul>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-800 mb-2">⚙️ Controles disponibles:</h4>
              <ul className="list-disc list-inside text-amber-700 space-y-1">
                <li>El video se reproduce automáticamente</li>
                <li>Se reinicia al llegar al final</li>
                <li>Las detecciones se guardan en tiempo real</li>
                <li>Los frames se actualizan cada segundo</li>
              </ul>
            </div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <p className="text-indigo-800">
              <strong>💡 Tip:</strong> El sistema procesa aproximadamente 1 frame por segundo para optimizar 
              el rendimiento. Las detecciones exitosas aparecerán con un borde verde en el video.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'historial',
      title: '📊 Historial',
      icon: '📈',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">Revisión del Historial de Detecciones</h3>
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">📋 Información mostrada:</h4>
              <ul className="list-disc list-inside text-purple-700 space-y-1">
                <li><strong>Número detectado:</strong> El número calado identificado por el modelo</li>
                <li><strong>Confianza:</strong> Porcentaje de certeza del modelo (0-100%)</li>
                <li><strong>Fecha y hora:</strong> Momento exacto de la detección</li>
                <li><strong>Coordenadas:</strong> Posición del número en la imagen</li>
                <li><strong>ID único:</strong> Identificador único de cada detección</li>
              </ul>
            </div>
            <div className="bg-cyan-50 p-4 rounded-lg">
              <h4 className="font-semibold text-cyan-800 mb-2">🔍 Funciones del historial:</h4>
              <ul className="list-disc list-inside text-cyan-700 space-y-1">
                <li>Ver todas las detecciones ordenadas por fecha</li>
                <li>Filtrar por número específico</li>
                <li>Ordenar por confianza o fecha</li>
                <li>Exportar datos para análisis</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sistema',
      title: '⚙️ Sistema',
      icon: '🔧',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">Arquitectura del Sistema</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">🎯 Frontend (React)</h4>
              <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
                <li>Interfaz de usuario</li>
                <li>Visualización de video</li>
                <li>Componentes interactivos</li>
                <li>Puerto 3000</li>
              </ul>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">🚀 Backend (FastAPI)</h4>
              <ul className="list-disc list-inside text-green-700 space-y-1 text-sm">
                <li>API REST</li>
                <li>Procesamiento de video</li>
                <li>Modelo YOLO</li>
                <li>Puerto 8000</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">🗄️ Base de Datos</h4>
              <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                <li>MongoDB</li>
                <li>Colección 'vagonetas'</li>
                <li>Almacenamiento de detecciones</li>
                <li>Puerto 27017</li>
              </ul>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">🤖 Modelo de IA:</h4>
            <p className="text-gray-700 text-sm">
              Utiliza YOLOv8 (You Only Look Once) entrenado específicamente para detectar números calados. 
              El modelo está ubicado en <code className="bg-gray-200 px-1 rounded">backend/models/numeros_calados/yolo_model/training/best.pt</code>
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'solución-problemas',
      title: '🛠️ Solución de Problemas',
      icon: '🔧',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">Problemas Comunes y Soluciones</h3>
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
              <h4 className="font-semibold text-red-800">❌ El video no se muestra</h4>
              <p className="text-red-700 mt-1">
                <strong>Solución:</strong> Verificar que el backend esté corriendo en puerto 8000. 
                Abrir terminal y ejecutar: <code className="bg-red-100 px-1 rounded">uvicorn main:app --reload</code>
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <h4 className="font-semibold text-yellow-800">⚠️ No hay detecciones</h4>
              <p className="text-yellow-700 mt-1">
                <strong>Solución:</strong> Esto es normal. El modelo detecta números específicos. 
                Las detecciones aparecen cuando el modelo identifica números calados con suficiente confianza.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-800">ℹ️ Error de conexión</h4>
              <p className="text-blue-700 mt-1">
                <strong>Solución:</strong> Verificar que MongoDB esté corriendo y que el backend pueda conectarse. 
                El sistema funciona sin base de datos pero no guardará detecciones.
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
              <h4 className="font-semibold text-green-800">✅ Performance lento</h4>
              <p className="text-green-700 mt-1">
                <strong>Normal:</strong> El procesamiento de video con IA requiere recursos. 
                El sistema está optimizado para procesar 1 frame por segundo.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'contacto',
      title: '📞 Contacto',
      icon: '📧',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-indigo-800">Soporte y Contacto</h3>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-indigo-800 mb-3">🏢 Información del Proyecto</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Proyecto:</strong> Sistema de Detección El Dorado</p>
                  <p><strong>Versión:</strong> 1.0.0</p>
                  <p><strong>Fecha:</strong> Junio 2025</p>
                  <p><strong>Tecnologías:</strong> React, FastAPI, YOLO, MongoDB</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-indigo-800 mb-3">📋 Recursos Técnicos</h4>
                <div className="space-y-1 text-sm">
                  <p>📄 <strong>API Docs:</strong> <a href="http://127.0.0.1:8000/docs" className="text-blue-600 hover:underline">http://127.0.0.1:8000/docs</a></p>
                  <p>🌐 <strong>Frontend:</strong> <a href="http://localhost:3000" className="text-blue-600 hover:underline">http://localhost:3000</a></p>
                  <p>🗄️ <strong>Base de datos:</strong> MongoDB 'el_dorado'</p>
                  <p>🤖 <strong>Modelo:</strong> YOLOv8 NumerosCalados</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-amber-800 text-center">
              💡 <strong>Tip:</strong> Para obtener logs detallados, revisar la consola del navegador (F12) 
              y los logs del backend en la terminal.
            </p>
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
