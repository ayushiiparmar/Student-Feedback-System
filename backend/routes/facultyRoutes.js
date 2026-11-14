const express = require('express');
const authorizeRole = require('../middleware/authorizeRole');
const requireAuth = require('../middleware/requireAuth');
const { getAssignedCourses, getCourseAnalytics } = require('../controllers/facultyController');

const router = express.Router();
router.use(requireAuth, authorizeRole('faculty'));

router.get('/courses', getAssignedCourses);
router.get('/courses/:courseId/analytics', getCourseAnalytics);

module.exports = router;
