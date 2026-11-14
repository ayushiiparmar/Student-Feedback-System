const express = require('express');
const authorizeRole = require('../middleware/authorizeRole');
const requireAuth = require('../middleware/requireAuth');
const admin = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, authorizeRole('admin'));

router.get('/students', admin.listStudents);
router.post('/students', admin.createStudent);
router.patch('/students/:id', admin.updateStudent);
router.delete('/students/:id', admin.deleteStudent);

router.get('/faculty', admin.listFaculty);
router.post('/faculty', admin.createFaculty);
router.patch('/faculty/:id', admin.updateFaculty);
router.delete('/faculty/:id', admin.deleteFaculty);

router.get('/courses', admin.listCourses);
router.post('/courses', admin.createCourse);
router.patch('/courses/:id', admin.updateCourse);
router.delete('/courses/:id', admin.deleteCourse);
router.patch('/courses/:id/faculty', admin.assignFaculty);
router.post('/courses/:id/students', admin.enrollStudent);
router.delete('/courses/:id/students/:studentId', admin.removeStudentEnrollment);
router.delete('/feedback/:id', admin.deleteFeedback);

module.exports = router;
