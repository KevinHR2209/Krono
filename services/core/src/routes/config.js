const express = require('express');
const { getClient } = require('../config/database');
const router = express.Router();

// 1. Obtener la configuración activa de un sistema (Tenant)
router.get('/api/v1/configuracion/:sistemaId', async (req, res) => {
    const client = await getClient();
    try {
        const { sistemaId } = req.params;
        const result = await client.query(
            `SELECT pesos, tiempo_expiracion_segundos, cantidad_notificar
             FROM configuracion_pesos
             WHERE sistema_origen_id = $1 AND activo = TRUE
             ORDER BY vigente_desde DESC LIMIT 1`,
            [sistemaId]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            // Valores por defecto seguros si no tiene configuración guardada
            res.json({ pesos: {}, tiempo_expiracion_segundos: 120, cantidad_notificar: 5 });
        }
    } catch (error) {
        console.error('[core] Error obteniendo configuración:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    } finally {
        client.release();
    }
});

// 2. Guardar una nueva configuración (JSON y Variables)
router.post('/api/v1/configuracion/:sistemaId', async (req, res) => {
    const client = await getClient();
    try {
        const { sistemaId } = req.params;
        const { pesos, tiempo_expiracion_segundos, cantidad_notificar } = req.body;

        await client.query('BEGIN');

        // Desactivamos el historial anterior para este cliente
        await client.query(
            `UPDATE configuracion_pesos SET activo = FALSE WHERE sistema_origen_id = $1`,
            [sistemaId]
        );

        // Insertamos la nueva configuración completa
        await client.query(
            `INSERT INTO configuracion_pesos (sistema_origen_id, pesos, tiempo_expiracion_segundos, cantidad_notificar, activo, creado_por)
             VALUES ($1, $2::jsonb, $3, $4, TRUE, 'admin_panel')`,
            [sistemaId, JSON.stringify(pesos), tiempo_expiracion_segundos || 120, cantidad_notificar || 5]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Configuración guardada exitosamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[core] Error guardando configuración:', error);
        res.status(500).json({ error: 'Error al guardar configuración' });
    } finally {
        client.release();
    }
});

module.exports = router;