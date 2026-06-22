const mysql = require("mysql");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "village_products",
  port: Number(process.env.DB_PORT) || 3306,
  connectionLimit: 10,
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(results);
    });
  });
}

module.exports = { pool, query };
