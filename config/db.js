// const mysql = require("mysql2");

// const connection = mysql
//   .createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     dateStrings: true,
//     waitForConnections: true,
//     connectionLimit: 4, 
//     queueLimit: 0,
//   })
//   .promise();

// module.exports = connection;

const mysql = require("mysql2");

// Check if a global connection pool already exists
if (!global.dbConnectionPool) {
  global.dbConnectionPool = mysql
    .createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 2, // 🔑 Dropped to 2 to leave breathing room for restarts
      queueLimit: 0,
    })
    .promise();
}

module.exports = global.dbConnectionPool;