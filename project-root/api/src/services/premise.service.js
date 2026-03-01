const db = require('../utils/db');
const auditService = require('./audit.service');

module.exports = {
  /**
   * List active premises, with optional search.
   */
  async list(search) {
    let sql = `SELECT * FROM core.premise WHERE status = 'ACTIVE'`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (premise_code ILIKE $1 OR state ILIKE $1 OR district ILIKE $1 OR address ILIKE $1)`;
    }
    sql += ' ORDER BY premise_code ASC';
    return db.query(sql, params);
  },

  /**
   * List inactive premises.
   */
  async listArchived(search) {
    let sql = `SELECT * FROM core.premise WHERE status = 'INACTIVE'`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (premise_code ILIKE $1 OR state ILIKE $1 OR district ILIKE $1 OR address ILIKE $1)`;
    }
    sql += ' ORDER BY premise_code ASC';
    return db.query(sql, params);
  },

  /**
   * List premises for dropdown (id + code only).
   */
  async listForDropdown() {
    return db.query(
      `SELECT premise_id, premise_code, state, district
       FROM core.premise WHERE status = 'ACTIVE'
       ORDER BY premise_code ASC`
    );
  },

  /**
   * Create a new premise.
   */
  async create(data, actorUserId) {
    // Check duplicate code
    const existing = await db.queryOne(
      'SELECT 1 FROM core.premise WHERE premise_code = $1',
      [data.premise_code]
    );
    if (existing) throw { status: 409, message: 'Premise code already exists' };

    const result = await db.queryOne(
      `INSERT INTO core.premise (premise_code, state, district, address, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING *`,
      [data.premise_code, data.state || null, data.district || null, data.address || null]
    );

    await auditService.log(
      actorUserId, 'CREATE', 'premise', String(result.premise_id),
      null, { premise_code: data.premise_code }
    );

    return result;
  },

  /**
   * Update a premise.
   */
  async update(id, data, actorUserId) {
    const existing = await db.queryOne(
      'SELECT * FROM core.premise WHERE premise_id = $1', [id]
    );
    if (!existing) throw { status: 404, message: 'Premise not found' };

    // Check duplicate code (exclude self)
    if (data.premise_code && data.premise_code !== existing.premise_code) {
      const dup = await db.queryOne(
        'SELECT 1 FROM core.premise WHERE premise_code = $1 AND premise_id != $2',
        [data.premise_code, id]
      );
      if (dup) throw { status: 409, message: 'Premise code already exists' };
    }

    const fields = ['premise_code', 'state', 'district', 'address'];
    const setClauses = [];
    const params = [];
    fields.forEach((f) => {
      if (data[f] !== undefined) {
        params.push(data[f]);
        setClauses.push(`${f} = $${params.length}`);
      }
    });

    if (setClauses.length === 0) throw { status: 400, message: 'No fields to update' };

    params.push(id);
    const result = await db.queryOne(
      `UPDATE core.premise SET ${setClauses.join(', ')} WHERE premise_id = $${params.length} RETURNING *`,
      params
    );

    await auditService.log(actorUserId, 'UPDATE', 'premise', String(id), null, data);
    return result;
  },

  /**
   * Soft delete — set status to INACTIVE. Check if users reference this premise first.
   */
  async softDelete(id, actorUserId) {
    const existing = await db.queryOne(
      'SELECT * FROM core.premise WHERE premise_id = $1', [id]
    );
    if (!existing) throw { status: 404, message: 'Premise not found' };

    // Check if users are linked
    const inUse = await db.queryOne(
      `SELECT 1 FROM core.user_profile WHERE premise_id = $1
       AND user_account_id IN (SELECT user_account_id FROM auth.user_account WHERE status = 'ACTIVE')`,
      [id]
    );
    if (inUse) {
      throw { status: 409, message: 'Cannot archive: premise is assigned to active users' };
    }

    await db.query(
      "UPDATE core.premise SET status = 'INACTIVE' WHERE premise_id = $1", [id]
    );

    await auditService.log(actorUserId, 'DELETE', 'premise', String(id),
      { status: existing.status }, { status: 'INACTIVE' });
    return { message: 'Premise archived' };
  },
};
