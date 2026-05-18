const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  return res.status(200).json({
    service: 'core',
    status: 'ok'
  });
});

app.use(webhookRouter);

app.use((req, res) => {
  return res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

module.exports = app;