const express = require('express');
const app = express();

app.use(express.json());

// Route for health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ghost-messenger' });
});

module.exports = app;