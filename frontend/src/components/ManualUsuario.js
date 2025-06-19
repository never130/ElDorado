import React, { useState } from 'react';

const ManualUsuario = () => {
  const [sectionOpen, setSectionOpen] = useState('como-usar');

  const sections = [
    {
      id: 'como-usar',
      title: ' Cómo Usar el Sistema',
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

            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-800 mb-2">📊 Consultar Historial</h4>
              <p className="text-blue-700 text-sm">
                Visualiza el registro histórico de detecciones. Filtra por fecha, número de vagoneta
                o túnel específico para encontrar la información que necesitas.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-800 mb-2">📹 Monitoreo en Vivo</h4>
              <p className="text-blue-700 text-sm">
                Configura cámaras para monitoreo en tiempo real. El sistema detectará 
                automáticamente las vagonetas que pasen frente a la cámara.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-800 mb-2">🔄 Trayectoria</h4>
              <p className="text-blue-700 text-sm">
                Visualiza el recorrido completo de una vagoneta específica a través de los distintos 
                puntos de control del sistema.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'conceptos',
      title: ' Conceptos Importantes',
      icon: '💡',
      content: (
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <h4 className="font-semibold text-yellow-800 mb-2">🔢 Números Calados</h4>
            <p className="text-yellow-700 text-sm">
              Son los identificadores únicos de cada vagoneta, recortados físicamente en la estructura
              metálica. El sistema está entrenado específicamente para reconocer estos números.
            </p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <h4 className="font-semibold text-yellow-800 mb-2">📊 Confianza de Detección</h4>
            <p className="text-yellow-700 text-sm">
              Cada detección tiene un valor de confianza entre 0 y 1 que indica qué tan seguro está el
              sistema de haber identificado correctamente el número. Valores cercanos a 1 indican alta
              confianza.
            </p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <h4 className="font-semibold text-yellow-800 mb-2">🕰️ Trayectoria y Eventos</h4>
            <p className="text-yellow-700 text-sm">
              El sistema registra automáticamente cada vez que una vagoneta es detectada, creando un
              historial de eventos que permite rastrear su movimiento a través de diferentes túneles.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'requisitos',
      title: ' Requisitos del Sistema',
      icon: '⚙️',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
            <h4 className="font-semibold text-gray-800 mb-2">🖥️ Hardware Recomendado</h4>
            <ul className="list-disc pl-5 text-gray-700 text-sm space-y-1">
              <li>Procesador: Intel Core i5 o superior</li>
              <li>Memoria RAM: 8GB mínimo, 16GB recomendado</li>
              <li>Almacenamiento: 100GB de espacio libre para videos y base de datos</li>
              <li>Tarjeta gráfica: Compatible con CUDA para procesamiento acelerado (opcional)</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
            <h4 className="font-semibold text-gray-800 mb-2">📡 Conectividad</h4>
            <ul className="list-disc pl-5 text-gray-700 text-sm space-y-1">
              <li>Conexión a red local para acceder al sistema desde múltiples dispositivos</li>
              <li>Conexión a cámaras IP para monitoreo en tiempo real</li>
              <li>Acceso a MongoDB para almacenamiento de datos</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
            <h4 className="font-semibold text-gray-800 mb-2">📱 Compatibilidad</h4>
            <ul className="list-disc pl-5 text-gray-700 text-sm space-y-1">
              <li>Navegadores: Chrome, Firefox, Edge (últimas versiones)</li>
              <li>Formatos de video soportados: MP4, AVI, MOV</li>
              <li>Formatos de imagen soportados: JPG, PNG</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'tips',
      title: ' Consejos y Solución de Problemas',
      icon: '🔍',
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <h4 className="font-semibold text-green-800 mb-2">📸 Mejores Prácticas para Captura</h4>
            <ul className="list-disc pl-5 text-green-700 text-sm space-y-1">
              <li>Asegúrate de que el número calado esté bien iluminado</li>
              <li>Mantén la cámara lo más estable posible</li>
              <li>Evita ángulos extremos que distorsionen los números</li>
              <li>Para monitoreo en vivo, coloca la cámara en un ángulo donde los números sean claramente visibles</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <h4 className="font-semibold text-green-800 mb-2">⚠️ Solución de Problemas</h4>
            <ul className="list-disc pl-5 text-green-700 text-sm space-y-1">
              <li><strong>No se detectan números:</strong> Verifica la iluminación y el ángulo de captura</li>
              <li><strong>Detecciones incorrectas:</strong> Ajusta los parámetros de confianza en la configuración</li>
              <li><strong>Cámara no funciona:</strong> Asegúrate de que no esté siendo usada por otra aplicación</li>
              <li><strong>Sistema lento:</strong> Reduce la resolución de video o actualiza el hardware</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <h4 className="font-semibold text-green-800 mb-2">💾 Respaldo de Datos</h4>
            <p className="text-green-700 text-sm">
              Recomendamos realizar copias de seguridad periódicas de la base de datos MongoDB para
              evitar pérdida de información histórica. Las imágenes y videos procesados también
              deberían respaldarse regularmente.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📚 Manual de Usuario</h1>
      
      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Secciones</h2>
              <nav className="space-y-2">
                {sections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => setSectionOpen(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition ${
                      sectionOpen === section.id
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="mr-2">{section.icon}</span>
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <div className="bg-white rounded-lg shadow-sm p-6">
            {sections.find(s => s.id === sectionOpen)?.content}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualUsuario;
