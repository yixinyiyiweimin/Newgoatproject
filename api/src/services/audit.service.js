const db = require('../utils/db');

module.exports = {
  async log(actorUserId, action, entityName, entityId, oldValue = null, newValue = null) {
    try {
      await db.query(
        `INSERT INTO audit.audit_log
         (actor_user_id, action, entity_name, entity_id, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          actorUserId,
          action,
          entityName,
          entityId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
        ]
      );
    } catch (error) {
      console.error('[AUDIT] Failed to log:', error);
      // Don't throw - audit failure shouldn't block main operation
    }
  },
};
