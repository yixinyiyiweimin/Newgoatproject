// RBAC permission checker middleware
// Per BLL.md 1E: Applied per route
// Usage: router.get('/goats', authenticate, checkPermission('goat', 'view'), handler)

module.exports = function checkPermission(moduleName, action) {
  return (req, res, next) => {
    const permissions = req.user?.permissions;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const hasPermission = permissions.some(
      p => p.module === moduleName && p.actions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};
