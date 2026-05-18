const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (error) => {
  console.error('[flash-fill][postgres] error inesperado en pool:', error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function testDatabaseConnection() {
  await pool.query('SELECT 1');
  console.log('[flash-fill][postgres] conexión OK');
}

module.exports = {
  pool,
  query,
  getClient,
  testDatabaseConnection
};