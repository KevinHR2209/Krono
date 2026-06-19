const express = require('express');
const cors = require('cors');
const confirmRouter = require('./routes/confirm');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'flash-fill',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1', confirmRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

app.use((err, req, res, next) => {
  console.error('[flash-fill] error no controlado:', err);

  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

module.exports = app;