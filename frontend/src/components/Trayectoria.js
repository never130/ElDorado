import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL, assetUrl } from "../config/api";
import { Search, Map, AlertCircle, CheckCircle2, Navigation, Activity, ArrowRight, ArrowLeft, Image as ImageIcon } from "lucide-react";
import Spinner from "./Spinner";

const Trayectoria = () => {
  const [numero, setNumero] = useState("");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBuscar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRegistros([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/trayectoria/${numero}`);
      setRegistros(res.data);
    } catch (err) {
      setError("No se encontró trayectoria para ese número de vagoneta.");
    }
    setLoading(false);
  };
  
  return (
    <div className="w-full max-w-5xl mx-auto card p-8 mt-6 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 flex justify-center items-center gap-3">
          <Map className="w-8 h-8 text-orange-600" /> Consultar Trayectoria
        </h2>
        <p className="text-slate-600 text-lg">
          Ingresa el número de una vagoneta para ver su historial completo de movimientos
        </p>
      </div>

      <form onSubmit={handleBuscar} className="max-w-md mx-auto mb-10">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Número (ej: 1234)"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-mono transition-shadow shadow-sm"
            />
          </div>
          <button 
            type="submit" 
            disabled={!numero.trim() || loading}
            className="btn-primary px-8"
          >
            {loading ? <Spinner size={20} color="#ffffff" /> : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Estado de carga */}
      {loading && (
        <div className="text-center py-12">
          <Spinner size={40} color="#ea580c" />
          <p className="text-slate-600 mt-4 font-medium">Buscando trayectoria...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center justify-center text-center mb-6 animate-in fade-in">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <div className="text-red-700 font-medium text-lg">{error}</div>
          <p className="text-red-500 text-sm mt-1">
            Verifica que el número de vagoneta sea correcto
          </p>
        </div>
      )}

      {/* Resultados */}
      {registros.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-emerald-900 mb-1">
                Trayectoria encontrada para la vagoneta #{numero}
              </h3>
              <p className="text-emerald-700 font-medium">
                Se encontraron {registros.length} registro{registros.length > 1 ? 's' : ''} de movimiento
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Evento</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Imagen</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Túnel</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Detalles</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {registros.map((registro, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${
                          registro.evento === 'ingreso' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {registro.evento === 'ingreso' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                          {registro.evento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        {registro.imagen_path ? (
                          <img 
                            src={assetUrl(registro.imagen_path)}
                            alt="vagoneta"
                            className="h-14 w-20 object-cover rounded-lg border border-slate-200 shadow-sm"
                          />
                        ) : (
                          <div className="h-14 w-20 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-600">
                        {new Date(registro.timestamp).toLocaleString('es-ES', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-900 font-medium">
                        {registro.tunel || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        <div className="flex flex-col gap-2">
                          {registro.merma && (
                            <span className="inline-flex items-center text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md w-fit">
                              Merma: {registro.merma}%
                            </span>
                          )}
                          {registro.modelo_ladrillo && (
                            <span className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md w-fit">
                              Modelo: {registro.modelo_ladrillo}
                            </span>
                          )}
                          {!registro.merma && !registro.modelo_ladrillo && <span className="text-slate-400">-</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium flex items-center gap-2">
                <Navigation className="w-4 h-4" /> Trayectoria completa
              </span>
              <span className="text-slate-700 font-bold bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
                Total: <span className="text-orange-600">{registros.length} movimientos</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trayectoria;
