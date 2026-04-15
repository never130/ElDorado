import './index.css';
import React, { useState } from "react";
import Upload from "./components/Upload";
import Historial from "./components/Historial";
import RealTimeMonitorNew from "./components/RealTimeMonitorNew";
import Trayectoria from "./components/Trayectoria";
import ManualUsuario from "./components/ManualUsuario";
import ModelConfig from "./components/ModelConfig";
import Reports from "./components/Reports";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import "./App.css";

const App = () => {
  const [view, setView] = useState("upload");
  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50">
      <Navbar view={view} setView={setView} />
      <main className="w-full flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {view === "upload" && <Upload />}
        {view === "historial" && <Historial />}
        {view === "realtime" && <RealTimeMonitorNew />}
        {view === "trayectoria" && <Trayectoria />}
        {view === "manual" && <ManualUsuario />}
        {view === "config" && <ModelConfig />}
        {view === "reports" && <Reports />}
      </main>
      <Footer />
    </div>
  );
}

export default App;
