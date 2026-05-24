import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Simulator from './components/Simulator';
import ConfirmationView from './components/ConfirmationView'; // Ajusta la ruta si lo guardaste en otra carpeta

export default function App() {
  return (
    <BrowserRouter>
      {/* El contenedor principal con el fondo oscuro que definimos */}
      <div className="min-h-screen bg-zinc-900 flex justify-center items-start">
        <div className="w-full max-w-3xl px-4">
          
          <Routes>
            {/* Ruta Principal: Panel Administrativo / QA */}
            <Route path="/" element={
              <div className="py-12">
                <header className="mb-8 border-b border-zinc-800 pb-4">
                  <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Krono <span className="text-emerald-500 text-sm font-mono align-top ml-1">ADMIN</span></h1>
                </header>
                <Simulator />
              </div>
            } />

            {/* Ruta del Paciente: Vista de Confirmación desde WhatsApp */}
            <Route path="/confirmar" element={<ConfirmationView />} />
            
          </Routes>
          
        </div>
      </div>
    </BrowserRouter>
  );
}