const db = require('../utils/db');
const auditService = require('./audit.service');

/**
 * Factory: creates a CRUD service for any admin_ref table.
 *
 * @param {Object} config
 * @param {string} config.tableName - e.g. 'admin_ref.vaccine_type'
 * @param {string} config.idColumn  - e.g. 'vaccine_type_id'
 * @param {string} config.entityName - e.g. 'vaccine_type' (for audit)
 * @param {string[]} config.columns - e.g. ['name', 'interval_days']
 * @param {string|null} config.inUseQuery - SQL checking if record is referenced
 * @param {string} config.inUseMessage - Error message if referenced
 */
function createRefDataService(config) {
  return {
    async list(search) {
      let sql = `SELECT * FROM ${config.tableName} WHERE is_active = true`;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND name ILIKE $${params.length}`;
      }
      sql += ' ORDER BY name ASC';
      return db.query(sql, params);
    },

    async listArchived(search) {
      let sql = `SELECT * FROM ${config.tableName} WHERE is_active = false`;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND name ILIKE $${params.length}`;
      }
      sql += ' ORDER BY name ASC';
      return db.query(sql, params);
    },

    async create(data, actorUserId) {
      // Check duplicate name
      const existing = await db.queryOne(
        `SELECT ${config.idColumn} FROM ${config.tableName} WHERE LOWER(name) = LOWER($1)`,
        [data.name]
      );
      if (existing) {
        throw { status: 409, message: `${config.entityName} name already exists` };
      }

      // Build INSERT dynamically
      const cols = config.columns;
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const values = cols.map((c) => data[c]);

      const result = await db.query(
        `INSERT INTO ${config.tableName} (${cols.join(', ')}, is_active)
         VALUES (${placeholders.join(', ')}, true)
         RETURNING *`,
        values
      );
      const created = result[0];

      await auditService.log(
        actorUserId, 'CREATE', config.entityName,
        String(created[config.idColumn]), null, data
      );
      return created;
    },

    async update(id, data, actorUserId) {
      // Check duplicate name (exclude self)
      if (data.name) {
        const existing = await db.queryOne(
          `SELECT ${config.idColumn} FROM ${config.tableName}
           WHERE LOWER(name) = LOWER($1) AND ${config.idColumn} != $2`,
          [data.name, id]
        );
        if (existing) {
          throw { status: 409, message: `${config.entityName} name already exists` };
        }
      }

      // Fetch old record for audit
      const old = await db.queryOne(
        `SELECT * FROM ${config.tableName} WHERE ${config.idColumn} = $1`,
        [id]
      );
      if (!old) throw { status: 404, message: `${config.entityName} not found` };

      // Build UPDATE SET clause dynamically
      const setClauses = [];
      const params = [];
      config.columns.forEach((col) => {
        if (data[col] !== undefined) {
          params.push(data[col]);
          setClauses.push(`${col} = $${params.length}`);
        }
      });

      if (setClauses.length === 0) {
        throw { status: 400, message: 'No fields to update' };
      }

      params.push(id);
      const result = await db.query(
        `UPDATE ${config.tableName}
         SET ${setClauses.join(', ')}
         WHERE ${config.idColumn} = $${params.length}
         RETURNING *`,
        params
      );

      await auditService.log(
        actorUserId, 'UPDATE', config.entityName,
        String(id), old, data
      );
      return result[0];
    },

    async delete(id, actorUserId) {
      // Check if in use
      if (config.inUseQuery) {
        const inUse = await db.queryOne(config.inUseQuery, [id]);
        if (inUse) {
          throw { status: 409, message: config.inUseMessage };
        }
      }

      // Verify exists
      const existing = await db.queryOne(
        `SELECT ${config.idColumn} FROM ${config.tableName} WHERE ${config.idColumn} = $1`,
        [id]
      );
      if (!existing) throw { status: 404, message: `${config.entityName} not found` };

      // Soft delete
      await db.query(
        `UPDATE ${config.tableName} SET is_active = false WHERE ${config.idColumn} = $1`,
        [id]
      );

      await auditService.log(actorUserId, 'DELETE', config.entityName, String(id));
      return { message: `${config.entityName} deactivated` };
    },
  };
}

module.exports = { createRefDataService };
