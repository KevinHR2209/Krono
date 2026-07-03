const express = require('express');
const app     = express();

app.use(express.json());

// ─── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ghost-messenger' });
});

// ─── Notificaciones ────────────────────────────────────────
app.post('/notifications', async (req, res) => {
  const { auction_id, appointment_id, slot, candidates } = req.body || {};

  // Validación básica
  if (!auction_id || !appointment_id || !slot || !Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({
      error: 'auction_id, appointment_id, slot y al menos un candidato son requeridos'
    });
  }

  try {
    const { enqueueNotification } = require('./workers/notificationWorker');
    const job = await enqueueNotification(auction_id, appointment_id, slot, candidates);
    return res.status(202).json({ message: 'Notificación encolada', jobId: job.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = app;