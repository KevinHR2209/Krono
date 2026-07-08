const express = require('express');
const cors = require('cors');
const webhookRouter = require('./routes/webhook');
const configRoutes = require('./routes/config');

const app = express();

app.use(configRoutes);
app.use(cors());
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