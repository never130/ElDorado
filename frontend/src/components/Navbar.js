import React, { useState } from "react";

const Navbar = ({ view, setView }) => {
  const [open, setOpen] = useState(false);
  return (
    <nav className="w-full bg-white border-b border-cyan-200 shadow-sm mb-6 sticky top-0 z-20">
      <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-2 md:px-8 py-2 max-w-full">
        <div className="flex items-center gap-3 mb-2 md:mb-0">
          <img src={process.env.PUBLIC_URL + "/logo.jpg"} alt="Logo" className="h-10 w-10 rounded-lg shadow" />
          <span className="text-xl md:text-2xl font-bold text-orange-600 tracking-tight">Seguimiento de Vagonetas</span>
        </div>
        <button className="md:hidden p-2 rounded text-cyan-700 hover:bg-cyan-100 absolute right-4 top-3" onClick={() => setOpen(!open)}>
          {/* Menú hamburguesa simple */}
          <span className="block w-7 h-1 bg-cyan-700 mb-1 rounded"></span>
          <span className="block w-7 h-1 bg-cyan-700 mb-1 rounded"></span>
          <span className="block w-7 h-1 bg-cyan-700 rounded"></span>
        </button>        <div className={`w-full md:w-auto flex-col md:flex md:flex-row md:gap-3 md:static absolute top-16 left-0 bg-white md:bg-transparent border-t md:border-none border-cyan-100 shadow md:shadow-none z-10 transition-all duration-200 ${open ? 'flex' : 'hidden'}`}>
          <button onClick={() => { setView('upload'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'upload' ? 'bg-blue-500 text-white shadow-lg' : 'bg-blue-100 text-blue-900 hover:bg-blue-200'} transition border border-blue-400`}>
            📤 Procesar Imágenes
          </button>
          <button onClick={() => { setView('realtime'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'realtime' ? 'bg-green-500 text-white shadow-lg' : 'bg-green-100 text-green-900 hover:bg-green-200'} transition border border-green-400`}>
            📡 Monitor en Vivo
          </button>
          <button onClick={() => { setView('trayectoria'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'trayectoria' ? 'bg-red-500 text-white shadow-lg' : 'bg-red-100 text-red-900 hover:bg-red-200'} transition border border-red-400`}>
            🛤️ Consultar
          </button>
          <button onClick={() => { setView('historial'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'historial' ? 'bg-orange-500 text-white shadow-lg' : 'bg-orange-100 text-orange-900 hover:bg-orange-200'} transition border border-orange-400`}>
            📊 Historial
          </button>          <button onClick={() => { setView('manual'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'manual' ? 'bg-purple-500 text-white shadow-lg' : 'bg-purple-100 text-purple-900 hover:bg-purple-200'} transition border border-purple-400`}>
            ❓ Ayuda
          </button>
          <button onClick={() => { setView('config'); setOpen(false); }} className={`w-full md:w-auto py-3 px-4 font-semibold rounded-lg m-1 md:m-0 ${view === 'config' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200'} transition border border-indigo-400`}>
            🧠 Modelo IA
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
