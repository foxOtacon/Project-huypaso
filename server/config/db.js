const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.DB_URL;
const WRAPPED_CLIENT = Symbol("wrappedClient");

const poolConfig = {
  connectionString,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 10000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,
};

if (connectionString && /supabase|postgres/i.test(connectionString)) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = connectionString ? new Pool(poolConfig) : null;

function normalizeParamValues(params = []) {
  if (params === undefined || params === null) {
    return [];
  }

  if (!Array.isArray(params)) {
    return [params === undefined ? null : params];
  }

  return params.map((param) => (param === undefined ? null : param));
}

function countPostgresPlaceholders(sql) {
  const matches = sql.match(/\$\d+/g);
  return matches ? matches.length : 0;
}

function normalizeSql(sql, params = []) {
  const values = [];
  let index = 0;
  let text = sql;

  if (!sql) {
    return { text, values };
  }

  const normalizedParams = normalizeParamValues(params);

  if (/\$\d+/.test(sql) && !/\?/.test(sql)) {
    return { text: sql, values: normalizedParams };
  }

  text = sql.replace(/\?/g, () => {
    const param = params[index++];

    if (Array.isArray(param)) {
      const placeholders = param.map((_, position) => `$${values.length + position + 1}`).join(", ");
      values.push(...param);
      return placeholders;
    }

    values.push(param === undefined ? null : param);
    return `$${values.length}`;
  });

  if (/^\s*insert\s+/i.test(sql) && !/\breturning\b/i.test(sql)) {
    text = `${text} RETURNING *`;
  }

  const placeholderCount = countPostgresPlaceholders(text);

  if (placeholderCount > 0 && values.length !== placeholderCount) {
    throw new Error(
      `SQL parameter mismatch: expected ${placeholderCount} values but received ${values.length}`,
    );
  }

  return { text, values };
}

function normalizeQueryArgs(sql, params, callback) {
  let values = params;
  let done = callback;

  if (typeof params === "function") {
    values = [];
    done = params;
  } else if (values === undefined || values === null) {
    values = [];
  } else if (!Array.isArray(values)) {
    values = [values];
  }

  const normalized = normalizeSql(sql, values);
  return { ...normalized, callback: done };
}

function logDbQueryError(error, sql, params) {
  if (process.env.DB_DEBUG !== "true" && error.code !== "42P02") {
    return;
  }

  console.error("[DB QUERY ERROR]", {
    message: error.message,
    code: error.code,
    position: error.position,
    sql,
    params,
  });
}

function findInsertId(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const keys = Object.keys(row);
  const idKey = keys.find((key) => key.toLowerCase() === "id" || key.toLowerCase().endsWith("_id"));

  return idKey ? row[idKey] : null;
}

function mapQueryResult(result, sql) {
  if (!result) {
    return result;
  }

  const rowCount = Number(result.rowCount ?? 0);
  const rows = Array.isArray(result.rows) ? result.rows : [];

  if (/^\s*insert\s+/i.test(sql)) {
    return {
      insertId: rows[0] ? findInsertId(rows[0]) : null,
      affectedRows: rowCount,
      rowCount,
      rows,
    };
  }

  if (/^(update|delete)\s+/i.test(sql)) {
    return {
      affectedRows: rowCount,
      rowCount,
      rows,
    };
  }

  return rows;
}

function wrapClient(client) {
  if (client[WRAPPED_CLIENT]) {
    return client;
  }

  const originalRelease = client.release.bind(client);
  const originalQuery = client.query.bind(client);

  client._query = originalQuery;
  client[WRAPPED_CLIENT] = true;
  client.release = () => {
    // Pool.query expects the native pg Result object. Leaving this compatibility
    // wrapper on a released client causes results to be mapped twice when the
    // pool reuses that client, which turns valid SELECT rows into an empty array.
    client.query = originalQuery;
    client.release = originalRelease;
    delete client._query;
    delete client[WRAPPED_CLIENT];
    originalRelease();
  };
  client.query = (sql, params, callback) => {
    const { text, values, callback: done } = normalizeQueryArgs(sql, params, callback);

    if (typeof done === "function") {
      client._query(text, values, (error, result) => {
        if (error) {
          logDbQueryError(error, text, values);
          done(error, null);
          return;
        }

        done(null, mapQueryResult(result, sql));
      });
      return;
    }

    return client._query(text, values).then((result) => mapQueryResult(result, sql));
  };

  client.beginTransaction = (callback) => {
    const run = () => client.query("BEGIN");

    if (typeof callback === "function") {
      run().then(() => callback(null)).catch(callback);
      return;
    }

    return run();
  };

  client.commit = (callback) => {
    const run = () => client.query("COMMIT");

    if (typeof callback === "function") {
      run().then(() => callback(null)).catch(callback);
      return;
    }

    return run();
  };

  client.rollback = (callback) => {
    const run = () => client.query("ROLLBACK");

    if (typeof callback === "function") {
      run().then(() => callback(null)).catch(callback);
      return;
    }

    return run();
  };

  return client;
}

if (pool) {
  const originalPoolQuery = pool.query.bind(pool);
  const originalPoolConnect = pool.connect.bind(pool);

  pool.query = (sql, params, callback) => {
    const { text, values, callback: done } = normalizeQueryArgs(sql, params, callback);

    if (typeof done === "function") {
      originalPoolQuery(text, values, (error, result) => {
        if (error) {
          logDbQueryError(error, text, values);
          done(error, null);
          return;
        }

        done(null, mapQueryResult(result, sql));
      });
      return;
    }

    return originalPoolQuery(text, values).then((result) => mapQueryResult(result, sql));
  };

  pool.getConnection = (callback) => {
    if (typeof callback === "function") {
      originalPoolConnect()
        .then((client) => callback(null, wrapClient(client)))
        .catch(callback);
      return;
    }

    return originalPoolConnect().then((client) => wrapClient(client));
  };
}

function query(sql, params = []) {
  if (!pool) {
    return Promise.reject(new Error("Supabase/Postgres connection string is not configured"));
  }

  if (typeof params === "function") {
    return new Promise((resolve, reject) => {
      pool.query(sql, [], (error, results) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(results);
      });
    });
  }

  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        logDbQueryError(error, sql, params);
        reject(error);
        return;
      }

      resolve(results);
    });
  });
}

module.exports = { pool, query };
