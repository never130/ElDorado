import React, { useState } from 'react';

const ManualUsuario = () => {
  const [sectionOpen, setSectionOpen] = useState('como-usar');
  const sections = [
    {
      id: 'como-usar',
      title: ' Cómo Usar el Sistema',
      icon: '🚀',
      content: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <h4 className="font-semibold text-blue-800 mb-3">📹 Captura en Tiempo Real</h4>
            <div className="text-blue-700 text-sm space-y-2">
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">1.</span>
                <span>Ir a la sección <strong>"Monitor en Vivo"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">2.</span>
                <span>Seleccionar una cámara conectada del menú desplegable</span>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">3.</span>
                <span>Presionar <strong>"▶️ Iniciar Monitor"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">4.</span>
                <span>Ver las detecciones aparecer automáticamente en tiempo real</span>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">5.</span>
                <span>Presionar <strong>"⏹️ Detener Monitor"</strong> cuando sea necesario</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <h4 className="font-semibold text-green-800 mb-3">� Carga Manual de Archivos</h4>
            <div className="text-green-700 text-sm space-y-2">
              <div className="flex items-start">
                <span className="text-green-600 mr-2">1.</span>
                <span>Ir a <strong>"Carga Manual"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-green-600 mr-2">2.</span>
                <span>Seleccionar imágenes o videos desde tu computadora</span>
              </div>
              <div className="flex items-start">
                <span className="text-green-600 mr-2">3.</span>
                <span>Presionar <strong>"Procesar Archivos"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-green-600 mr-2">4.</span>
                <span>Ver los resultados de detección directamente en pantalla</span>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
            <h4 className="font-semibold text-purple-800 mb-3">� Historial de Detecciones</h4>
            <div className="text-purple-700 text-sm space-y-2">
              <div className="flex items-start">
                <span className="text-purple-600 mr-2">1.</span>
                <span>Ir a <strong>"Historial"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-purple-600 mr-2">2.</span>
                <span>Ver tabla completa con todos los eventos detectados</span>
              </div>
              <div className="flex items-start">
                <span className="text-purple-600 mr-2">3.</span>
                <span>Aplicar filtros por fecha, número, cámara o tipo de evento</span>
              </div>
              <div className="flex items-start">
                <span className="text-purple-600 mr-2">4.</span>
                <span>Exportar los datos en formato CSV/Excel si es necesario</span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
            <h4 className="font-semibold text-orange-800 mb-3">🔄 Trayectoria de una Vagoneta</h4>
            <div className="text-orange-700 text-sm space-y-2">
              <div className="flex items-start">
                <span className="text-orange-600 mr-2">1.</span>
                <span>Ingresar a <strong>"Trayectoria"</strong></span>
              </div>
              <div className="flex items-start">
                <span className="text-orange-600 mr-2">2.</span>
                <span>Escribir el número de vagoneta que quieres rastrear</span>
              </div>
              <div className="flex items-start">
                <span className="text-orange-600 mr-2">3.</span>
                <span>Visualizar todas las detecciones en orden cronológico</span>
              </div>
              <div className="flex items-start">
                <span className="text-orange-600 mr-2">4.</span>
                <span>Descargar el reporte completo del recorrido si es necesario</span>
              </div>            </div>
          </div>
        </div>
      )
    },
    {
      id: 'buenas-practicas',
      title: ' Buenas Prácticas',
      icon: '✨',
      content: (
        <div className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800 mb-3">🏁 Antes de Comenzar</h4>
            <ul className="list-disc pl-5 text-indigo-700 text-sm space-y-1">
              <li>Verificar que MongoDB esté activo y funcionando</li>
              <li>Usar un navegador moderno y actualizado (Chrome, Firefox, Edge)</li>
              <li>Confirmar que los archivos de configuración estén completos</li>
              <li>Asegurarse de tener suficiente espacio en disco para videos</li>
            </ul>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800 mb-3">⚡ Durante el Uso</h4>
            <ul className="list-disc pl-5 text-indigo-700 text-sm space-y-1">
              <li>Mantener abiertas ambas consolas (backend y frontend)</li>
              <li>No abrir múltiples instancias del sistema simultáneamente</li>
              <li>Hacer pruebas con archivos pequeños antes de cargar datos reales</li>
              <li>Monitorear el rendimiento del sistema durante uso intensivo</li>
            </ul>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800 mb-3">📹 Con Cámaras</h4>
            <ul className="list-disc pl-5 text-indigo-700 text-sm space-y-1">
              <li>Ubicarlas en zonas bien iluminadas y estables</li>
              <li>No moverlas durante la ejecución del sistema</li>
              <li>Verificar que estén correctamente definidas en cameras_config.json</li>
              <li>Probar la conexión antes de iniciar monitoreo prolongado</li>
            </ul>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800 mb-3">📁 Con Archivos</h4>
            <ul className="list-disc pl-5 text-indigo-700 text-sm space-y-1">
              <li>Usar imágenes o videos claros y en formatos válidos (JPG, PNG, MP4, AVI)</li>
              <li>Evitar archivos muy pesados si tu computadora es lenta</li>
              <li>Comprobar que se vean bien los números calados antes de procesar</li>
              <li>Organizar archivos en carpetas por fecha o evento</li>
            </ul>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
            <h4 className="font-semibold text-indigo-800 mb-3">⚠️ Otras Sugerencias</h4>
            <ul className="list-disc pl-5 text-indigo-700 text-sm space-y-1">
              <li>No modificar el código sin saber lo que estás haciendo</li>
              <li>Pedir asistencia técnica en caso de errores persistentes</li>
              <li>Hacer respaldos regulares si vas a reinstalar o borrar carpetas</li>
              <li>Documentar cualquier configuración personalizada que hagas</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'faq',
      title: ' Preguntas Frecuentes',
      icon: '❓',
      content: (
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">🗄️ ¿Qué pasa si no tengo MongoDB instalado?</h4>
            <p className="text-red-700 text-sm">
              No podrás ejecutar el sistema correctamente. MongoDB es necesario para almacenar 
              los datos de detecciones. Instálalo siguiendo las instrucciones de configuración inicial.
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">📷 ¿Puedo usar el sistema sin cámara?</h4>
            <p className="text-red-700 text-sm">
              ¡Sí! Puedes usar perfectamente la opción de <strong>"Carga Manual"</strong> para 
              procesar imágenes y videos desde tu computadora sin necesidad de cámaras en tiempo real.
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">📁 ¿Qué tipos de archivos acepta?</h4>
            <div className="text-red-700 text-sm">
              <p className="mb-2"><strong>Imágenes:</strong> .jpg, .png, .webp</p>
              <p><strong>Videos:</strong> .mp4, .avi, .mov</p>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">🔍 No detecta nada, ¿qué hago?</h4>
            <ul className="list-disc pl-5 text-red-700 text-sm space-y-1">
              <li>Asegúrate de que el modelo YOLO esté en la carpeta backend/models/</li>
              <li>Verifica que no haya errores al iniciar el backend</li>
              <li>Usa imágenes más nítidas y bien iluminadas</li>
              <li>Verifica que los números calados sean claramente visibles</li>
            </ul>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">📹 Tengo una cámara conectada pero no aparece</h4>
            <ul className="list-disc pl-5 text-red-700 text-sm space-y-1">
              <li>Revisa que no esté siendo usada por otra aplicación</li>
              <li>Verifica su configuración en el archivo cameras_config.json</li>
              <li>Reinicia la computadora si el sistema no la detecta</li>
              <li>Prueba desconectar y volver a conectar la cámara USB</li>
            </ul>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
            <h4 className="font-semibold text-red-800 mb-2">⚠️ Aparece un error en consola</h4>
            <div className="text-red-700 text-sm">
              <p className="mb-2">Para resolver errores:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Lee el mensaje completo del error</li>
                <li>Busca palabras clave como "missing", "permission" o "not found"</li>
                <li>Verifica que todos los servicios estén ejecutándose</li>
                <li>Consulta este manual o contacta soporte técnico</li>
              </ul>
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
