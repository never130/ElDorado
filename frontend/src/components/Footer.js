import React from "react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-slate-200 mt-auto py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-500 text-sm text-center md:text-left">
            <p>&copy; {currentYear} Todos los derechos reservados.</p>
            <p className="mt-1">
              Software hecho exclusivamente para <span className="font-semibold text-slate-700">El Dorado S.R.L.</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Desarrollado por</span>
            <a 
              href="https://inteligencia-fueguina.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-orange-600 font-semibold hover:text-orange-700 transition-colors text-sm"
            >
              Inteligencia-fueguina.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
