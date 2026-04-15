import React, { useState } from 'react';
import { BookOpen, Rocket, ShieldCheck, HelpCircle, Lightbulb, ChevronRight, Play, Upload, History, Map, Database, Monitor, AlertTriangle, FileVideo, ShieldAlert, Cpu, Activity } from 'lucide-react';

const ManualUsuario = () => {
  const [sectionOpen, setSectionOpen] = useState('como-usar');
  const sections = [
    {
      id: 'como-usar',
      title: 'Cómo Usar el Sistema',
      icon: Rocket,
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-orange-600" /> Captura en Tiempo Real
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">1</span>
                <span className="mt-0.5">Ir a la sección <strong>"Monitor en Vivo"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">2</span>
                <span className="mt-0.5">Seleccionar una cámara conectada del menú desplegable</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">3</span>
                <span className="mt-0.5">Presionar <strong>"Iniciar Monitor"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">4</span>
                <span className="mt-0.5">Ver las detecciones aparecer automáticamente en tiempo real</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" /> Carga Manual de Archivos
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">1</span>
                <span className="mt-0.5">Ir a <strong>"Procesar Imágenes"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">2</span>
                <span className="mt-0.5">Seleccionar imágenes o videos desde tu computadora</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">3</span>
                <span className="mt-0.5">Presionar <strong>"Iniciar Procesamiento"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">4</span>
                <span className="mt-0.5">Ver los resultados de detección directamente en pantalla</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" /> Historial de Detecciones
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold shrink-0">1</span>
                <span className="mt-0.5">Ir a <strong>"Historial"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold shrink-0">2</span>
                <span className="mt-0.5">Ver tabla completa con todos los eventos detectados</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold shrink-0">3</span>
                <span className="mt-0.5">Aplicar filtros por fecha o buscar por número</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold shrink-0">4</span>
                <span className="mt-0.5">Exportar los datos en formato CSV si es necesario</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
              <Map className="w-5 h-5 text-orange-600" /> Trayectoria de Vagoneta
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">1</span>
                <span className="mt-0.5">Ingresar a <strong>"Trayectoria"</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">2</span>
                <span className="mt-0.5">Escribir el número de vagoneta que quieres rastrear</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">3</span>
                <span className="mt-0.5">Visualizar todas las detecciones en orden cronológico</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'buenas-practicas',
      title: 'Buenas Prácticas',
      icon: ShieldCheck,
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Antes de Comenzar</h4>
            <ul className="list-none space-y-2 text-orange-800 text-sm">
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Verificar que MongoDB esté activo y funcionando</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Usar un navegador moderno y actualizado (Chrome, Edge)</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Confirmar que los archivos de configuración estén completos</li>
            </ul>
          </div>

          <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2"><Play className="w-4 h-4" /> Durante el Uso</h4>
            <ul className="list-none space-y-2 text-orange-800 text-sm">
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Mantener abiertas ambas consolas (backend y frontend)</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> No abrir múltiples instancias del sistema simultáneamente</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Monitorear el rendimiento del sistema durante uso intensivo</li>
            </ul>
          </div>

          <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2"><Monitor className="w-4 h-4" /> Con Cámaras</h4>
            <ul className="list-none space-y-2 text-orange-800 text-sm">
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Ubicarlas en zonas bien iluminadas y estables</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> No moverlas durante la ejecución del sistema</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Verificar que estén definidas en cameras_config.json</li>
            </ul>
          </div>

          <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2"><FileVideo className="w-4 h-4" /> Con Archivos</h4>
            <ul className="list-none space-y-2 text-orange-800 text-sm">
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Usar formatos válidos (JPG, PNG, MP4, AVI)</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Comprobar que se vean bien los números antes de procesar</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" /> Organizar archivos en carpetas por fecha o evento</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'faq',
      title: 'Preguntas Frecuentes',
      icon: HelpCircle,
      content: (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-rose-500" /> ¿Qué pasa si no tengo MongoDB instalado?
            </h4>
            <p className="text-slate-600 text-sm pl-6">
              No podrás ejecutar el sistema correctamente. MongoDB es necesario para almacenar los datos de detecciones. Instálalo siguiendo las instrucciones de configuración inicial.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-rose-500" /> ¿Puedo usar el sistema sin cámara?
            </h4>
            <p className="text-slate-600 text-sm pl-6">
              ¡Sí! Puedes usar perfectamente la opción de <strong>"Procesar Imágenes"</strong> para procesar imágenes y videos desde tu computadora sin necesidad de cámaras en tiempo real.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-rose-500" /> No detecta nada, ¿qué hago?
            </h4>
            <ul className="list-disc pl-11 text-slate-600 text-sm space-y-1">
              <li>Asegúrate de que el modelo YOLO esté en la carpeta backend/models/</li>
              <li>Usa imágenes más nítidas y bien iluminadas</li>
              <li>Verifica que los números calados sean claramente visibles</li>
            </ul>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Aparece un error en consola
            </h4>
            <p className="text-slate-600 text-sm pl-6">
              Lee el mensaje completo del error. Busca palabras clave como "missing", "permission" o "not found". Verifica que todos los servicios estén ejecutándose y consulta con soporte técnico si persiste.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'conceptos',
      title: 'Conceptos Importantes',
      icon: Lightbulb,
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm">
            <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-200 flex items-center justify-center text-amber-800">12</div>
              Números Calados
            </h4>
            <p className="text-amber-800 text-sm leading-relaxed">
              Son los identificadores únicos de cada vagoneta, recortados físicamente en la estructura metálica. El sistema está entrenado específicamente para reconocer estos números.
            </p>
          </div>

          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm">
            <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-700" />
              Confianza de Detección
            </h4>
            <p className="text-amber-800 text-sm leading-relaxed">
              Cada detección tiene un valor de confianza entre 0 y 1 que indica qué tan seguro está el sistema de haber identificado correctamente el número. Valores cercanos a 1 indican alta confianza.
            </p>
          </div>
          
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm md:col-span-2">
            <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              Merma y Modelo de Ladrillo
            </h4>
            <p className="text-amber-800 text-sm leading-relaxed">
              El sistema también puede detectar el tipo de ladrillo cargado y estimar si existe una merma significativa en la carga de la vagoneta.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 min-h-screen">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center justify-center gap-3">
          <BookOpen className="w-8 h-8 text-orange-600" /> Manual de Usuario
        </h1>
        <p className="text-slate-600 text-lg max-w-2xl mx-auto">
          Guía completa para el uso del sistema de seguimiento de vagonetas y detección automática mediante IA.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-sm">
              Contenido
            </div>
            <nav className="p-2 flex flex-col gap-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = sectionOpen === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSectionOpen(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      isActive 
                        ? 'bg-orange-50 text-orange-700 font-bold' 
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="md:w-2/3">
          {sections.map((section) => (
            <div 
              key={section.id} 
              className={sectionOpen === section.id ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3 pb-4 border-b border-slate-200">
                <section.icon className="w-7 h-7 text-orange-600" />
                {section.title}
              </h2>
              {section.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualUsuario;
