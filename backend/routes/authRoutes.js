const express = require('express');
const { login, registerStudent } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerStudent);
router.post('/login', login);

module.exports = router;
