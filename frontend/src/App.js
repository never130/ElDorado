import './index.css';
import React, { useState } from "react";
import Historial from "./components/Historial";
import VideoTrainingMonitor from "./components/VideoTrainingMonitor";
import ManualUsuario from "./components/ManualUsuario";
import Navbar from "./components/Navbar";
import "./App.css";

const App = () => {
  const [view, setView] = useState("video-training");

  return (
    <div className="w-full min-h-screen flex flex-col bg-cyan-50">
      <Navbar view={view} setView={setView} />      <main className="w-full flex-1 flex flex-col items-center">
        {view === "video-training" && <VideoTrainingMonitor />}
        {view === "historial" && <Historial />}
        {view === "manual" && <ManualUsuario />}
      </main>
    </div>
  );
}

export default App;
