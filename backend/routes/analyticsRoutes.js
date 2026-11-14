const express = require('express');
const authorizeRole = require('../middleware/authorizeRole');
const requireAuth = require('../middleware/requireAuth');
const { getAdminAnalytics } = require('../controllers/analyticsController');

const router = express.Router();
router.use(requireAuth, authorizeRole('admin'));
router.get('/', getAdminAnalytics);

module.exports = router;
