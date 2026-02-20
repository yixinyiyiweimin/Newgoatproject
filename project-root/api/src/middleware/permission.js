/**
 * Check if user has permission for a specific module and action.
 * Usage: checkPermission('goat', 'create')
 */
module.exports = (moduleName, action) => {
  return (req, res, next) => {
    // req.user comes from auth middleware (already attached)
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Find permission entry for this module
    const modulePermission = req.user.permissions.find(
      (p) => p.module === moduleName
    );

    if (!modulePermission) {
      return res.status(403).json({
        message: `No permissions for module: ${moduleName}`,
      });
    }

    // Check if action is allowed
    if (!modulePermission.actions.includes(action)) {
      return res.status(403).json({
        message: `Action '${action}' not allowed for module '${moduleName}'`,
      });
    }

    next();
  };
};
