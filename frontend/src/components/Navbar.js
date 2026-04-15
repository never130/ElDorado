import React, { useState } from "react";
import { Menu, X, Image as ImageIcon, Activity, History, FileText, HelpCircle, Settings } from "lucide-react";

const Navbar = ({ view, setView }) => {
  const [open, setOpen] = useState(false);

  const navItems = [
    { id: 'upload', label: 'Procesar Imágenes', icon: ImageIcon },
    { id: 'realtime', label: 'Monitor en Vivo', icon: Activity },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'reports', label: 'Reportes', icon: FileText },
    { id: 'manual', label: 'Ayuda', icon: HelpCircle },
    { id: 'config', label: 'Herramientas', icon: Settings },
  ];

  return (
    <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Logo El Dorado" className="w-10 h-10 object-cover rounded-xl shadow-sm" />
            <span className="text-xl font-bold text-slate-800 tracking-tight">Seguimiento de Vagonetas</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-orange-50 text-orange-700 shadow-sm border border-orange-100' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-orange-600' : 'text-slate-400'} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setOpen(!open)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500"
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive 
                      ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-orange-600' : 'text-slate-400'} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
