const express = require('express');
const { getClient } = require('../config/database');
const router = express.Router();

router.get('/api/v1/analytics/dashboard', async (req, res) => {
    const client = await getClient();
    try {
        // 1. KPI: Subastas totales procesadas hoy
        const hoyResult = await client.query(
            `SELECT COUNT(*) as total FROM subastas WHERE iniciada_en >= CURRENT_DATE`
        );

        // 2. KPI: Tasa de recuperación global
        const tasaResult = await client.query(
            `SELECT
                 COUNT(*) as total_subastas,
                 COUNT(CASE WHEN estado = 'reasignada' THEN 1 END) as exitosas
             FROM transacciones`
        );

        const totalSubastas = parseInt(tasaResult.rows[0].total_subastas) || 0;
        const exitosas = parseInt(tasaResult.rows[0].exitosas) || 0;
        const tasaRecuperacion = totalSubastas > 0 ? ((exitosas / totalSubastas) * 100).toFixed(1) : "0.0";

        // 3. KPI: Subastas activas en este preciso momento
        const activasResult = await client.query(
            `SELECT COUNT(*) as total FROM subastas WHERE estado = 'activa'`
        );

        // 4. Desglose por Tenant / Industria
        const industriasResult = await client.query(
            `SELECT
                 so.nombre as tenant,
                 COUNT(s.id) as total,
                 COUNT(CASE WHEN t.estado = 'reasignada' THEN 1 END) as exitosas
             FROM sistemas_origen so
                      LEFT JOIN citas c ON c.sistema_origen_id = so.id
                      LEFT JOIN subastas s ON s.cita_id = c.id
                      LEFT JOIN transacciones t ON t.subasta_id = s.id
             GROUP BY so.nombre`
        );

        const desgloseIndustrias = industriasResult.rows.map(row => {
            const total = parseInt(row.total) || 0;
            const win = parseInt(row.exitosas) || 0;
            const porc = total > 0 ? Math.round((win / total) * 100) : 0;
            return {
                tenant: row.tenant,
                porcentaje: porc,
                total: total
            };
        });

        res.json({
            subastas_hoy: parseInt(hoyResult.rows[0].total) || 0,
            tasa_recuperacion: `${tasaRecuperacion}%`,
            subastas_activas: parseInt(activasResult.rows[0].total) || 0,
            desglose: desgloseIndustrias
        });

    } catch (error) {
        console.error('[Analytics Error]:', error);
        res.status(500).json({ error: 'Error al compilar métricas en tiempo real' });
    } finally {
        client.release();
    }
});

module.exports = router;