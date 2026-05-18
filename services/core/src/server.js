require('dotenv').config();

const app = require('./app');
require('./config/database');
require('./config/redis');
require('./config/queue');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`[core] Servicio escuchando en http://localhost:${port}`);
});