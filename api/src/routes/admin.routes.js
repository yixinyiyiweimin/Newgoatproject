const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// All admin routes require authentication
router.use(auth);

// Sub-route mounts
router.use('/dashboard', require('./admin/dashboard.routes'));
router.use('/vaccine-types', require('./admin/vaccineType.routes'));
router.use('/breeding-types', require('./admin/breedingType.routes'));
router.use('/goat-breeds', require('./admin/goatBreed.routes'));
router.use('/users', require('./admin/user.routes'));
router.use('/roles', require('./admin/role.routes'));
router.use('/premises', require('./admin/premise.routes'));

module.exports = router;
