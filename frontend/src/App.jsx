
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Simulator from './components/Simulator';
import ConfirmationView from './components/ConfirmationView';
import ClinicDashboard from './components/ClinicDashboard';

function NavigationMenu() {
  const location = useLocation();
  if (location.pathname === '/confirmar') return null;

  return (
      <nav className="flex gap-6 p-4 mt-8 mb-8 bg-zinc-950 rounded-xl border border-zinc-800 text-sm font-mono tracking-wide justify-center shadow-lg">
        <Link
            to="/"
            className={`hover:text-emerald-400 transition-colors ${location.pathname === '/' ? 'text-emerald-500 font-bold' : 'text-zinc-500'}`}
        >
          [01] Admin_Krono
        </Link>
        <Link
            to="/clinica"
            className={`hover:text-blue-400 transition-colors ${location.pathname === '/clinica' ? 'text-blue-500 font-bold' : 'text-zinc-500'}`}
        >
          [02] Sistema_Clinica
        </Link>
      </nav>
  );
}

export default function App() {
  return (
      <BrowserRouter>
        <div className="min-h-screen bg-zinc-900 flex justify-center items-start">
          <div className="w-full max-w-4xl px-4">
            <NavigationMenu />
            <Routes>
              <Route path="/" element={
                <div className="py-4">
                  <header className="mb-8 border-b border-zinc-800 pb-4">
                    <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
                      Krono <span className="text-emerald-500 text-sm font-mono align-top ml-1">ADMIN</span>
                    </h1>
                  </header>
                  <Simulator />
                </div>
              } />
              <Route path="/clinica" element={<div className="py-4"><ClinicDashboard /></div>} />
              <Route path="/confirmar" element={<ConfirmationView />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
  );
}