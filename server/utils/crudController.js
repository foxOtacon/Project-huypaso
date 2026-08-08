const { query } = require("../config/db");

function buildInsertPayload(body, fields) {
  const payload = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  return payload;
}

function buildUpdatePayload(body, fields) {
  const payload = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  return payload;
}

function createCrudController({ table, idField, fields, requiredFields = [], afterUpdate }) {
  return {
    getAll: async (_req, res) => {
      const rows = await query(`SELECT * FROM ${table} ORDER BY ${idField} DESC`);
      res.json({ success: true, data: rows });
    },

    getById: async (req, res) => {
      const rows = await query(`SELECT * FROM ${table} WHERE ${idField} = ?`, [
        req.params.id,
      ]);

      if (rows.length === 0) {
        res.status(404).json({ success: false, message: "Record not found" });
        return;
      }

      res.json({ success: true, data: rows[0] });
    },

    create: async (req, res) => {
      const missingFields = requiredFields.filter(
        (field) =>
          req.body[field] === undefined ||
          req.body[field] === null ||
          req.body[field] === ""
      );

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        return;
      }

      const payload = buildInsertPayload(req.body, fields);

      if (Object.keys(payload).length === 0) {
        res.status(400).json({ success: false, message: "No valid fields provided" });
        return;
      }

      const columns = Object.keys(payload);
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((column) => payload[column]);

      const result = await query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        values
      );

      const rows = await query(`SELECT * FROM ${table} WHERE ${idField} = ?`, [
        result.insertId,
      ]);

      res.status(201).json({ success: true, data: rows[0] });
    },

    update: async (req, res) => {
      const payload = buildUpdatePayload(req.body, fields);

      if (Object.keys(payload).length === 0) {
        res.status(400).json({ success: false, message: "No valid fields to update" });
        return;
      }

      const previousRows = afterUpdate
        ? await query(`SELECT * FROM ${table} WHERE ${idField} = ?`, [req.params.id])
        : [];
      const columns = Object.keys(payload);
      const assignments = columns.map((column) => `${column} = ?`).join(", ");
      const values = [...columns.map((column) => payload[column]), req.params.id];

      const result = await query(
        `UPDATE ${table} SET ${assignments} WHERE ${idField} = ?`,
        values
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, message: "Record not found" });
        return;
      }

      const rows = await query(`SELECT * FROM ${table} WHERE ${idField} = ?`, [
        req.params.id,
      ]);

      if (afterUpdate) {
        try {
          await afterUpdate(previousRows[0], rows[0]);
        } catch (error) {
          console.error(`Post-update cleanup failed for ${table}:`, error);
        }
      }

      res.json({ success: true, data: rows[0] });
    },

    remove: async (req, res) => {
      const result = await query(`DELETE FROM ${table} WHERE ${idField} = ?`, [
        req.params.id,
      ]);

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, message: "Record not found" });
        return;
      }

      res.json({ success: true, message: "Record deleted successfully" });
    },
  };
}

module.exports = createCrudController;
