import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Simulator from './components/Simulator';
import ConfirmationView from './components/ConfirmationView';
import ClinicDashboard from './components/ClinicDashboard';

function NavigationMenu() {
    const location = useLocation();
    if (location.pathname === '/confirmar') return null;

    return (
        <nav className="flex gap-6 p-4 mt-8 mb-8 bg-white rounded-xl border border-slate-200 text-sm font-medium tracking-wide justify-center shadow-sm">
            <Link
                to="/"
                className={`hover:text-emerald-600 transition-colors ${location.pathname === '/' ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}
            >
                [01] Admin_Krono
            </Link>
            <Link
                to="/clinica"
                className={`hover:text-blue-600 transition-colors ${location.pathname === '/clinica' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}
            >
                [02] Sistema_Clinica
            </Link>
        </nav>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-slate-50 flex justify-center items-start font-sans text-slate-800">
                <div className="w-full max-w-4xl px-4">
                    <NavigationMenu />
                    <Routes>
                        <Route path="/" element={
                            <div className="py-4">
                                <header className="mb-8 border-b border-slate-200 pb-4">
                                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                        Krono
                                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-md align-middle">
                        ADMIN
                      </span>
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