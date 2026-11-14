const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { createToken } = require('../utils/jwt');
const {
  assertAllowedKeys,
  requiredString,
  validateEmail,
  validatePassword
} = require('../utils/validation');

async function registerStudent(request, response) {
  assertAllowedKeys(request.body, ['name', 'email', 'password', 'department', 'semester']);

  const userData = {
    name: requiredString(request.body.name, 'Name', 100),
    email: validateEmail(request.body.email),
    password: validatePassword(request.body.password),
    department: requiredString(request.body.department, 'Department', 100),
    semester: requiredString(request.body.semester, 'Semester', 50),
    role: 'student'
  };

  if (await User.exists({ email: userData.email })) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = await User.create(userData);
  response.status(201).json({
    message: 'Student account registered successfully.',
    user: user.toJSON()
  });
}

async function login(request, response) {
  assertAllowedKeys(request.body, ['email', 'password']);
  const email = validateEmail(request.body.email);
  if (typeof request.body.password !== 'string' || request.body.password.length === 0) {
    throw new ApiError(400, 'Password is required.');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(request.body.password, user.password))) {
    throw new ApiError(401, 'Email or password is incorrect.');
  }

  response.json({
    token: createToken(user._id),
    user: user.toJSON()
  });
}

module.exports = { login, registerStudent };
