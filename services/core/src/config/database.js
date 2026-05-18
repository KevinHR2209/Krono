const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

const pool = new Pool({
  connectionString: databaseUrl
});

pool.on('error', (error) => {
  console.error('[core][postgres] Error inesperado en el pool:', error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

module.exports = {
  pool,
  query,
  getClient
};