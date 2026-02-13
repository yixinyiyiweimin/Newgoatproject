// Audit log helper - reused by all modules
// Per BLL.md: POST /audit/audit_log
const postgrest = require('../utils/postgrest');

module.exports = {
  async log({ actorUserId, action, entityName, entityId, oldValue, newValue }) {
    try {
      await postgrest.create('audit', 'audit_log', {
        actor_user_id: actorUserId,
        action,
        entity_name: entityName,
        entity_id: entityId,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null
      });
    } catch (err) {
      // Audit logging should not break the main flow
      console.error('[AUDIT] Failed to log:', err.message);
    }
  }
};
