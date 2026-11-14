const express = require('express');
const authorizeRole = require('../middleware/authorizeRole');
const requireAuth = require('../middleware/requireAuth');
const {
  getEnrolledCourses,
  getFeedbackStatus,
  getOwnFeedback,
  getProfile,
  submitFeedback
} = require('../controllers/studentController');

const router = express.Router();
router.use(requireAuth, authorizeRole('student'));

router.get('/profile', getProfile);
router.get('/courses', getEnrolledCourses);
router.get('/feedback/status', getFeedbackStatus);
router.get('/feedback', getOwnFeedback);
router.post('/feedback', submitFeedback);

module.exports = router;
