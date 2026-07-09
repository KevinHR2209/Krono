import { useState, useEffect } from 'react';

const TENANTS = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Barbería Krono', icon: '✂️', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'SportCenter Viña', icon: '⚽', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Cafetería Especialidad', icon: '☕', color: 'text-amber-600', bg: 'bg-amber-50' }
];

export default function TenantManager() {
    const [activeTenant, setActiveTenant] = useState(TENANTS[0]);
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        fetchConfig(activeTenant.id);
    }, [activeTenant]);

    const fetchConfig = async (tenantId) => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/v1/configuracion/${tenantId}`);

            // Validación estricta: Si el backend devuelve un error 500, lanzamos una excepción
            if (!res.ok) {
                throw new Error(`Error HTTP del servidor: ${res.status}`);
            }

            const data = await res.json();
            setConfig(data || {});
        } catch (error) {
            console.error('[Frontend] Error obteniendo configuración:', error);
            setNotification({ type: 'error', text: 'Fallo de conexión. Revisa la consola para más detalles.' });
        } finally {
            setLoading(false);
        }
    };

    const handleWeightChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    const handleAddParameter = () => {
        const paramName = prompt('Nombre del nuevo parámetro (ej. nivel_urgencia):');
        if (paramName && paramName.trim() !== '') {
            const formattedName = paramName.trim().toLowerCase().replace(/\s+/g, '_');
            setConfig(prev => ({ ...prev, [formattedName]: 0.10 }));
        }
    };

    const handleRemoveParameter = (keyToRemove) => {
        const newConfig = { ...config };
        delete newConfig[keyToRemove];
        setConfig(newConfig);
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch(`http://localhost:3000/api/v1/configuracion/${activeTenant.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!res.ok) {
                throw new Error(`Error HTTP al guardar: ${res.status}`);
            }

            setNotification({ type: 'success', text: 'Parámetros guardados y activos en producción.' });
            setTimeout(() => setNotification(null), 4000);
        } catch (error) {
            console.error('[Frontend] Error guardando configuración:', error);
            setNotification({ type: 'error', text: 'Error al sincronizar con Krono.' });
        } finally {
            setSaving(false);
        }
    };

    const totalWeight = Object.values(config).reduce((acc, val) => acc + val, 0);
    const isTotalValid = Math.abs(totalWeight - 1.0) < 0.01;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mt-8 font-sans overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
                {TENANTS.map((tenant) => (
                    <button
                        key={tenant.id}
                        onClick={() => setActiveTenant(tenant)}
                        className={`flex-1 py-4 px-6 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                            activeTenant.id === tenant.id
                                ? 'bg-white border-b-2 border-slate-800 text-slate-900 shadow-[0_-4px_0_0_inset_#1e293b]'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                    >
                        <span>{tenant.icon}</span> {tenant.name}
                    </button>
                ))}
            </div>

            <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Motor de Ponderación</h2>
                        <p className="text-slate-500 mt-1">
                            Ajusta los parámetros JSON dinámicos que el algoritmo usará para {activeTenant.name}.
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[120px] ${isTotalValid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <span className="text-xs font-bold uppercase tracking-widest">Suma Total</span>
                        <span className="text-2xl font-black">{(totalWeight * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {loading ? (
                    <div className="animate-pulse flex flex-col gap-4">
                        <div className="h-12 bg-slate-100 rounded-xl w-full"></div>
                        <div className="h-12 bg-slate-100 rounded-xl w-full"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(config).map(([parametro, peso]) => (
                            <div key={parametro} className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col gap-3 group relative">
                                <div className="flex justify-between items-center">
                                    <span className="font-mono text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                                      "{parametro}"
                                    </span>
                                    <span className="font-bold text-lg text-slate-800">{(peso * 100).toFixed(0)}%</span>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={peso}
                                    onChange={(e) => handleWeightChange(parametro, e.target.value)}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
                                />

                                <button
                                    onClick={() => handleRemoveParameter(parametro)}
                                    className="absolute -top-3 -right-3 bg-red-100 text-red-600 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-xs shadow-sm hover:bg-red-200"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={handleAddParameter}
                            className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-semibold hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="text-xl leading-none">+</span> Añadir nueva métrica
                        </button>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <button
                        onClick={saveConfig}
                        disabled={saving || !isTotalValid}
                        className="w-full bg-slate-800 text-white py-4 px-4 rounded-xl hover:bg-slate-900 disabled:bg-slate-300 disabled:text-slate-500 transition-all font-semibold tracking-wide text-lg shadow-md disabled:shadow-none"
                    >
                        {saving ? "Guardando..." : "Sincronizar con el Motor Krono"}
                    </button>
                    {!isTotalValid && (
                        <p className="text-center text-red-500 mt-3 text-sm font-medium">
                            ⚠ La suma de los pesos debe ser exactamente 100% para poder guardar.
                        </p>
                    )}
                </div>

                {notification && (
                    <div className={`mt-6 p-4 rounded-xl font-medium text-sm flex items-center gap-2 ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        <span>{notification.type === 'success' ? '✅' : '❌'}</span> {notification.text}
                    </div>
                )}
            </div>
        </div>
    );
}