const db = require('../utils/db');

module.exports = {
  /**
   * Admin Dashboard — URS 2.1.2
   * Returns premise counts, state distribution, user count.
   * Optional filters: premise_id, ic_number
   */
  async getAdminDashboard(filters = {}) {
    const { premise_id, ic_number } = filters;
    let scopedPremiseId = null;

    // If filtering by IC, resolve to premise_id first
    if (ic_number) {
      const profile = await db.queryOne(
        'SELECT premise_id FROM core.user_profile WHERE ic_or_passport = $1',
        [ic_number]
      );
      if (!profile || !profile.premise_id) {
        return {
          total_premises: 0,
          premises_by_state: [],
          premises_by_district: [],
          total_users: 0,
        };
      }
      scopedPremiseId = profile.premise_id;
    } else if (premise_id) {
      scopedPremiseId = premise_id;
    }

    // Build premise filter
    const premiseParams = [];
    let premiseWhere = "WHERE status = 'ACTIVE'";
    if (scopedPremiseId) {
      premiseParams.push(scopedPremiseId);
      premiseWhere += ` AND premise_id = $${premiseParams.length}`;
    }

    // Run all queries in parallel
    const [totalPremises, premisesByState, premisesByDistrict, totalUsers] = await Promise.all([
      db.queryOne(
        `SELECT COUNT(*) AS count FROM core.premise ${premiseWhere}`,
        premiseParams
      ),
      db.query(
        `SELECT state, COUNT(*) AS count FROM core.premise ${premiseWhere} GROUP BY state ORDER BY count DESC`,
        premiseParams
      ),
      db.query(
        `SELECT state, district, COUNT(*) AS count FROM core.premise ${premiseWhere} GROUP BY state, district ORDER BY state, count DESC`,
        premiseParams
      ),
      db.queryOne(
        "SELECT COUNT(*) AS count FROM auth.user_account WHERE status = 'ACTIVE'",
        []
      ),
    ]);

    return {
      total_premises: parseInt(totalPremises.count),
      premises_by_state: premisesByState,
      premises_by_district: premisesByDistrict,
      total_users: parseInt(totalUsers.count),
    };
  },
};
