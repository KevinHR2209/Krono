import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TenantManager from './components/TenantManager';
import ConfirmationView from './components/ConfirmationView';
import './App.css';

function Navbar() {
    const location = useLocation();

    // No mostrar la navegación en la interfaz móvil del paciente
    if (location.pathname.startsWith('/confirmar')) return null;

    return (
        <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-sm font-sans">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Isotipo y Título de la Plataforma */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-tr from-slate-700 to-slate-800 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-sm border border-slate-600">
                        K
                    </div>
                    <div>
                        <span className="text-white font-extrabold text-base tracking-tight block">Krono Control</span>
                        <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider block -mt-1">Orquestador SaaS</span>
                    </div>
                </div>

                {/* Links de Navegación con Estilo Unificado */}
                <div className="flex items-center gap-2 h-full">
                    <Link
                        to="/"
                        className={`px-4 h-10 flex items-center rounded-lg text-sm font-semibold transition-all ${
                            location.pathname === '/'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        Observabilidad Global
                    </Link>
                    <Link
                        to="/configuracion"
                        className={`px-4 h-10 flex items-center rounded-lg text-sm font-semibold transition-all ${
                            location.pathname === '/configuracion'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        Gestión Tenants SaaS
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-slate-50 flex flex-col antialiased selection:bg-slate-800 selection:text-white">
                <Navbar />
                <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/configuracion" element={<TenantManager />} />
                        <Route path="/confirmar" element={<ConfirmationView />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}