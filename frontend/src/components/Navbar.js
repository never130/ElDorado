import React, { useState } from "react";

const Navbar = ({ view, setView }) => {
  const [open, setOpen] = useState(false);
  return (    <nav className="w-full bg-white border-b border-slate-200 mb-6 sticky top-0 z-20">
      <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-8 py-4 max-w-full">
        <div className="flex items-center gap-3 mb-2 md:mb-0">
          <img src={process.env.PUBLIC_URL + "/logo.jpg"} alt="Logo" className="h-10 w-10 rounded-md" />
          <span className="text-xl md:text-2xl font-semibold text-orange-600 tracking-tight">Seguimiento de Vagonetas</span>
        </div>
        <button className="md:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 absolute right-4 top-4 transition-colors" onClick={() => setOpen(!open)}>
          {/* Menú hamburguesa simple */}
          <span className="block w-6 h-0.5 bg-slate-600 mb-1 rounded"></span>
          <span className="block w-6 h-0.5 bg-slate-600 mb-1 rounded"></span>
          <span className="block w-6 h-0.5 bg-slate-600 rounded"></span>
        </button>        <div className={`w-full md:w-auto flex-col md:flex md:flex-row md:gap-2 md:static absolute top-16 left-0 bg-white md:bg-transparent border-t md:border-none border-slate-200 z-10 transition-all duration-200 ${open ? 'flex' : 'hidden'}`}>
          <button onClick={() => { setView('upload'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'upload' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Procesar Imágenes
          </button>
          <button onClick={() => { setView('realtime'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'realtime' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Monitor en Vivo
          </button>
          {/* Botón "Consultar" oculto por petición del usuario */}
          {/*
          <button onClick={() => { setView('trayectoria'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'trayectoria' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Consultar
          </button>
          */}
          <button onClick={() => { setView('historial'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'historial' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Historial
          </button>
          <button onClick={() => { setView('manual'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'manual' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Ayuda
          </button>
          <button onClick={() => { setView('config'); setOpen(false); }} className={`w-full md:w-auto py-2.5 px-4 font-medium rounded-md m-1 md:m-0 transition-colors ${view === 'config' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Herramientas Avanzadas
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
