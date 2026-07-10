const express = require('express');
const cors = require('cors');
const webhookRouter = require('./routes/webhook');
const configRoutes = require('./routes/config');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// 1. MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json());

// 2. RUTAS DE SALUD (HEALTHCHECK)
app.get('/health', (_req, res) => {
  return res.status(200).json({
    service: 'core',
    status: 'ok'
  });
});

// 3. RUTAS DE LA APLICACIÓN
app.use(configRoutes);
app.use(webhookRouter);
app.use(analyticsRoutes);

// 4. MANEJO DE RUTAS NO ENCONTRADAS (404)
app.use((req, res) => {
  return res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

module.exports = app;