const express = require('express');
const router = express.Router();
const checkPermission = require('../../middleware/permission');
const dashboardService = require('../../services/dashboard.service');

// GET /api/admin/dashboard
router.get('/', checkPermission('dashboard', 'view'), async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminDashboard({
      premise_id: req.query.premise_id,
      ic_number: req.query.ic,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
