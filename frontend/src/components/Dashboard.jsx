import React, { useState, useEffect } from 'react';

export default function Dashboard() {
    const [metrics, setMetrics] = useState({
        subastas_hoy: 0,
        tasa_recuperacion: '0.0%',
        subastas_activas: 0,
        desglose: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMetrics() {
            try {
                const res = await fetch('http://localhost:3000/api/v1/analytics/dashboard');
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);
                }
            } catch (error) {
                console.error('Error cargando métricas reales:', error);
            } finally {
                setLoading(false);
            }
        }
        loadMetrics();
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-center font-medium text-slate-500 animate-pulse">
                Conectando con el motor analítico de Krono...
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm font-sans">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Observabilidad de Operaciones</h1>
                <p className="text-sm text-slate-500 mt-1">Métricas e indicadores en tiempo real extraídos del orquestador transaccional.</p>
            </div>

            {/* Tarjetas de KPIs Reales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subastas Ejecutadas (Hoy)</h3>
                    <span className="text-4xl font-black text-slate-800">{metrics.subastas_hoy}</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Eficiencia de Recuperación</h3>
                    <span className="text-4xl font-black text-emerald-600">{metrics.tasa_recuperacion}</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Procesos Activos</h3>
                    <span className="text-4xl font-black text-blue-600">{metrics.subastas_activas}</span>
                </div>
            </div>

            {/* Desglose por Cliente */}
            <div className="border-t border-slate-100 pt-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Rendimiento por Tenant Activo</h3>

                {metrics.desglose.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No se registran datos operacionales en los sistemas origen todavía.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {metrics.desglose.map((item, index) => (
                            <div key={index} className="bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                                <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                                    <span>{item.tenant}</span>
                                    <span className="text-slate-500">{item.porcentaje}% ({item.total} req)</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-slate-800 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${item.porcentaje}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}