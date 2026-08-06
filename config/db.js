const mysql = require("mysql2");

const connection = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 4, 
    queueLimit: 0,
  })
  .promise();

module.exports = connection;
