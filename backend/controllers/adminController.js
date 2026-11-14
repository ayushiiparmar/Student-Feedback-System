const Course = require('../models/Course');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  assertAllowedKeys,
  assertObjectBody,
  requiredString,
  validateEmail,
  validateObjectId,
  validatePassword
} = require('../utils/validation');

const userFields = ['name', 'email', 'password', 'department', 'semester'];
const courseFields = ['courseName', 'courseCode', 'department', 'semester'];

function getUserInput(body, partial) {
  assertAllowedKeys(body, userFields);
  const data = {};
  userFields.forEach(function (field) {
    if (body[field] === undefined) {
      if (!partial) throw new ApiError(400, `${field} is required.`);
      return;
    }

    if (field === 'email') data.email = validateEmail(body.email);
    else if (field === 'password') data.password = validatePassword(body.password);
    else data[field] = requiredString(body[field], field, field === 'semester' ? 50 : 100);
  });
  if (partial && Object.keys(data).length === 0) {
    throw new ApiError(400, 'Provide at least one field to update.');
  }
  return data;
}

async function findUserByRole(idValue, role) {
  const id = validateObjectId(idValue, 'User ID');
  const user = await User.findOne({ _id: id, role });
  if (!user) throw new ApiError(404, `${role[0].toUpperCase()}${role.slice(1)} not found.`);
  return user;
}

async function listUsers(request, response, role) {
  const users = await User.find({ role })
    .select('-password')
    .sort({ name: 1 })
    .lean();
  response.json({ users });
}

async function createUser(request, response, role) {
  const userData = getUserInput(request.body, false);
  userData.role = role;
  const user = await User.create(userData);
  response.status(201).json({ user: user.toJSON() });
}

async function updateUser(request, response, role) {
  const data = getUserInput(request.body, true);
  const user = await findUserByRole(request.params.id, role);
  Object.assign(user, data);
  await user.save();
  response.json({ user: user.toJSON() });
}

async function deleteStudent(request, response) {
  const student = await findUserByRole(request.params.id, 'student');
  await Course.updateMany(
    { enrolledStudents: student._id },
    { $pull: { enrolledStudents: student._id } }
  );
  await Feedback.deleteMany({ student: student._id });
  await student.deleteOne();
  response.json({ message: 'Student and associated feedback were deleted.' });
}

async function deleteFaculty(request, response) {
  const faculty = await findUserByRole(request.params.id, 'faculty');
  if (await Course.exists({ faculty: faculty._id })) {
    throw new ApiError(409, 'Reassign this faculty member’s courses before deleting the account.');
  }
  await faculty.deleteOne();
  response.json({ message: 'Faculty account deleted.' });
}

async function listCourses(request, response) {
  const courses = await Course.find()
    .select('courseName courseCode department semester faculty enrolledStudents')
    .populate('faculty', 'name email department')
    .sort({ courseCode: 1 })
    .lean();
  response.json({
    courses: courses.map(function (course) {
      return { ...course, enrolledCount: course.enrolledStudents.length };
    })
  });
}

function getCourseInput(body, partial) {
  const allowedFields = partial
    ? courseFields
    : courseFields.concat(['facultyId', 'enrolledStudentIds']);
  assertAllowedKeys(body, allowedFields);
  const data = {};

  courseFields.forEach(function (field) {
    if (body[field] === undefined) {
      if (!partial) throw new ApiError(400, `${field} is required.`);
      return;
    }
    data[field] = requiredString(body[field], field, field === 'semester' ? 50 : 100);
  });

  if (!partial) {
    data.faculty = validateObjectId(body.facultyId, 'Faculty ID');
    const enrolledStudentIds = body.enrolledStudentIds === undefined ? [] : body.enrolledStudentIds;
    if (!Array.isArray(enrolledStudentIds)) {
      throw new ApiError(400, 'enrolledStudentIds must be an array of student IDs.');
    }
    data.enrolledStudents = enrolledStudentIds.map(function (id) {
      return validateObjectId(id, 'Student ID');
    });
  }

  if (partial && Object.keys(data).length === 0) {
    throw new ApiError(400, 'Provide at least one course field to update.');
  }
  return data;
}

async function createCourse(request, response) {
  const course = await Course.create(getCourseInput(request.body, false));
  await course.populate('faculty', 'name email department');
  response.status(201).json({ course });
}

async function updateCourse(request, response) {
  const courseId = validateObjectId(request.params.id, 'Course ID');
  const data = getCourseInput(request.body, true);
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found.');
  Object.assign(course, data);
  await course.save();
  await course.populate('faculty', 'name email department');
  response.json({ course });
}

async function deleteCourse(request, response) {
  const courseId = validateObjectId(request.params.id, 'Course ID');
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found.');
  await Feedback.deleteMany({ course: course._id });
  await course.deleteOne();
  response.json({ message: 'Course and associated feedback were deleted.' });
}

async function assignFaculty(request, response) {
  assertAllowedKeys(request.body, ['facultyId']);
  const courseId = validateObjectId(request.params.id, 'Course ID');
  const facultyId = validateObjectId(request.body.facultyId, 'Faculty ID');
  const [course, faculty] = await Promise.all([
    Course.findById(courseId),
    User.findOne({ _id: facultyId, role: 'faculty' }).select('_id')
  ]);
  if (!course) throw new ApiError(404, 'Course not found.');
  if (!faculty) throw new ApiError(404, 'Faculty member not found.');
  course.faculty = faculty._id;
  await course.save();
  await course.populate('faculty', 'name email department');
  response.json({ course });
}

async function enrollStudent(request, response) {
  assertAllowedKeys(request.body, ['studentId']);
  const courseId = validateObjectId(request.params.id, 'Course ID');
  const studentId = validateObjectId(request.body.studentId, 'Student ID');
  const [course, student] = await Promise.all([
    Course.findById(courseId).select('courseCode enrolledStudents'),
    User.findOne({ _id: studentId, role: 'student' }).select('_id')
  ]);
  if (!course) throw new ApiError(404, 'Course not found.');
  if (!student) throw new ApiError(404, 'Student not found.');
  if (course.enrolledStudents.some(function (id) { return id.equals(student._id); })) {
    throw new ApiError(409, 'Student is already enrolled in this course.');
  }

  course.enrolledStudents.push(student._id);
  await course.save();
  response.status(201).json({
    message: 'Student enrolled successfully.',
    courseCode: course.courseCode,
    studentId: String(student._id),
    enrolledCount: course.enrolledStudents.length
  });
}

async function removeStudentEnrollment(request, response) {
  const courseId = validateObjectId(request.params.id, 'Course ID');
  const studentId = validateObjectId(request.params.studentId, 'Student ID');
  const course = await Course.findById(courseId).select('courseCode enrolledStudents');
  if (!course) throw new ApiError(404, 'Course not found.');
  const studentIsEnrolled = course.enrolledStudents.some(function (id) {
    return id.equals(studentId);
  });
  if (!studentIsEnrolled) throw new ApiError(404, 'Student is not enrolled in this course.');
  if (await Feedback.exists({ course: course._id, student: studentId })) {
    throw new ApiError(409, 'Enrollment cannot be removed after feedback has been submitted.');
  }

  course.enrolledStudents.pull(studentId);
  await course.save();
  response.json({
    message: 'Student enrollment removed.',
    courseCode: course.courseCode,
    enrolledCount: course.enrolledStudents.length
  });
}

async function deleteFeedback(request, response) {
  const feedbackId = validateObjectId(request.params.id, 'Feedback ID');
  const feedback = await Feedback.findById(feedbackId).select('_id');
  if (!feedback) throw new ApiError(404, 'Feedback not found.');

  await feedback.deleteOne();
  response.json({ message: 'Feedback deleted.' });
}

module.exports = {
  assignFaculty,
  createCourse,
  createFaculty: function (request, response) { return createUser(request, response, 'faculty'); },
  createStudent: function (request, response) { return createUser(request, response, 'student'); },
  deleteFeedback,
  deleteCourse,
  deleteFaculty,
  deleteStudent,
  enrollStudent,
  listCourses,
  listFaculty: function (request, response) { return listUsers(request, response, 'faculty'); },
  listStudents: function (request, response) { return listUsers(request, response, 'student'); },
  removeStudentEnrollment,
  updateCourse,
  updateFaculty: function (request, response) { return updateUser(request, response, 'faculty'); },
  updateStudent: function (request, response) { return updateUser(request, response, 'student'); }
};
