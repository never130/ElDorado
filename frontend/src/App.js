import './index.css';
import React, { useState } from "react";
import Upload from "./components/Upload";
import Historial from "./components/Historial";
import RealTimeMonitor from "./components/RealTimeMonitor";
import Trayectoria from "./components/Trayectoria";
import ManualUsuario from "./components/ManualUsuario";
import ModelConfig from "./components/ModelConfig";
import Navbar from "./components/Navbar";
import "./App.css";

const App = () => {
  const [view, setView] = useState("upload");

  return (
    <div className="w-full min-h-screen flex flex-col bg-cyan-50">
      <Navbar view={view} setView={setView} />      <main className="w-full flex-1 flex flex-col items-center">
        {view === "upload" && <Upload />}
        {view === "historial" && <Historial />}
        {view === "realtime" && <RealTimeMonitor />}
        {view === "trayectoria" && <Trayectoria />}
        {view === "manual" && <ManualUsuario />}
        {view === "config" && <ModelConfig />}
      </main>
    </div>
  );
}

export default App;
