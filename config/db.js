const mysql = require("mysql2");

const connection = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 3, 
    queueLimit: 0,
    // enableKeepAlive: true, // <--- Add this to keep connections alive
    // keepAliveInitialDelay: 10000 // <--- 10 seconds
  })
  .promise();

// Gracefully close the pool so connections don't leak when the process
// restarts (e.g. nodemon) or is killed.
async function closePool(signal) {
  console.log(`Received ${signal}, closing MySQL pool...`);
  try {
    await connection.end();
    console.log("MySQL pool closed.");
  } catch (err) {
    console.error("Error closing MySQL pool:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => closePool("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => closePool("SIGTERM")); // normal kill
process.on("SIGUSR2", () => closePool("SIGUSR2")); // nodemon restart signal

module.exports = connection;