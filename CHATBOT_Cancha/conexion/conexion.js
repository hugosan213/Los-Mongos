// conexion.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'bdgenerica',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Probar conexión al iniciar
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conexión a MySQL establecida correctamente.");
    connection.release();
  } catch (error) {
    console.error("❌ Error al conectar con MySQL:", error.message);
  }
})();

module.exports = pool;
