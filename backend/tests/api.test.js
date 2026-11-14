require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');
const app = require('../app');
const Course = require('../models/Course');
const Feedback = require('../models/Feedback');
const User = require('../models/User');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'api-test-only-secret-not-for-production-123456';
process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI
  || 'mongodb://127.0.0.1:27017/studentFeedbackTestDB';

const runId = crypto.randomBytes(5).toString('hex');
const emailFor = function (name) { return `${name}.${runId}@example.test`; };
const password = 'TestPassword123!';
const userIds = [];
const courseIds = [];
const createdUserIds = [];
const createdCourseIds = [];
let server;
let baseUrl;
let admin;
let faculty;
let otherFaculty;
let student;
let outsider;
let course;
let otherCourse;
let tokens;
let submittedFeedbackId;
let createdStudentId;
let createdFacultyId;
let createdCourseId;

async function request(path, options) {
  const settings = options || {};
  const headers = { Accept: 'application/json' };
  if (settings.token) headers.Authorization = `Bearer ${settings.token}`;
  if (settings.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method: settings.method || 'GET',
    headers,
    body: settings.body === undefined ? undefined : JSON.stringify(settings.body)
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

async function createUser(name, role, email) {
  const user = await User.create({
    name,
    email: email || emailFor(name.toLowerCase().replace(/\s+/g, '.')),
    password,
    role,
    department: 'Test Engineering',
    semester: 'Test Term'
  });
  userIds.push(user._id);
  return user;
}

async function createCourse(courseCode, assignedFaculty, enrolledStudents) {
  const entry = await Course.create({
    courseName: `Test Course ${courseCode}`,
    courseCode,
    department: 'Test Engineering',
    semester: 'Test Term',
    faculty: assignedFaculty._id,
    enrolledStudents: enrolledStudents.map(function (entry) { return entry._id; })
  });
  courseIds.push(entry._id);
  return entry;
}

before(async function () {
  await mongoose.connect(process.env.MONGODB_TEST_URI);
  await Promise.all([User.init(), Course.init(), Feedback.init()]);

  admin = await createUser('Test Admin', 'admin', emailFor('admin'));
  faculty = await createUser('Test Faculty', 'faculty', emailFor('faculty'));
  otherFaculty = await createUser('Other Faculty', 'faculty', emailFor('other-faculty'));
  student = await createUser('Test Student', 'student', emailFor('student'));
  outsider = await createUser('Outside Student', 'student', emailFor('outsider'));
  course = await createCourse(`API${runId}A`, faculty, [student]);
  otherCourse = await createCourse(`API${runId}B`, otherFaculty, [outsider]);

  server = await new Promise(function (resolve, reject) {
    const listener = app.listen(0, '127.0.0.1', function () {
      resolve(listener);
    });
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async function () {
  if (mongoose.connection.readyState === 1) {
    const allUserIds = userIds.concat(createdUserIds);
    const allCourseIds = courseIds.concat(createdCourseIds);
    await Feedback.deleteMany({
      $or: [
        { student: { $in: allUserIds } },
        { course: { $in: allCourseIds } }
      ]
    });
    await Course.deleteMany({ _id: { $in: allCourseIds } });
    await User.deleteMany({ _id: { $in: allUserIds } });
  }
  if (server) {
    await new Promise(function (resolve, reject) {
      server.close(function (error) {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  await mongoose.disconnect();
});

test('authenticated API behavior and role restrictions', async function (t) {
  await t.test('health check and student registration validation', async function () {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const extraRole = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Invalid Role',
        email: emailFor('invalid-role'),
        password,
        department: 'Test Engineering',
        semester: 'Test Term',
        role: 'admin'
      }
    });
    assert.equal(extraRole.status, 400);

    const invalidEmail = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Invalid Email',
        email: 'not-an-email',
        password,
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(invalidEmail.status, 400);

    const registered = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Registered Test Student',
        email: emailFor('registered'),
        password,
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.role, 'student');
    assert.equal(Object.hasOwn(registered.body.user, 'password'), false);
    createdStudentId = registered.body.user._id;
    createdUserIds.push(createdStudentId);

    const storedRegistered = await User.findById(createdStudentId).select('+password');
    assert.notEqual(storedRegistered.password, password);

    const duplicate = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate Student',
        email: emailFor('registered'),
        password,
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(duplicate.status, 409);

    const weakPassword = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Weak Password',
        email: emailFor('weak-password'),
        password: 'short',
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(weakPassword.status, 400);
  });

  await t.test('login, invalid credentials, and protected-route authorization', async function () {
    const invalidLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: emailFor('student'), password: 'WrongPassword123!' }
    });
    assert.equal(invalidLogin.status, 401);

    const login = async function (user) {
      const result = await request('/auth/login', {
        method: 'POST',
        body: { email: user.email, password }
      });
      assert.equal(result.status, 200);
      assert.ok(result.body.token);
      assert.equal(Object.hasOwn(result.body.user, 'password'), false);
      return result.body.token;
    };

    tokens = {
      admin: await login(admin),
      faculty: await login(faculty),
      otherFaculty: await login(otherFaculty),
      student: await login(student),
      outsider: await login(outsider)
    };

    const missingToken = await request('/student/profile');
    assert.equal(missingToken.status, 401);

    const wrongRole = await request('/admin/analytics', { token: tokens.student });
    assert.equal(wrongRole.status, 403);

    const facultyWrongRole = await request('/student/profile', { token: tokens.faculty });
    assert.equal(facultyWrongRole.status, 403);

    const missingRoute = await request('/not-a-route', { token: tokens.admin });
    assert.equal(missingRoute.status, 404);
  });

  await t.test('student profile, enrolled courses, feedback validation and history', async function () {
    const profile = await request('/student/profile', { token: tokens.student });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.email, student.email);
    assert.equal(Object.hasOwn(profile.body.user, 'password'), false);

    const courses = await request('/student/courses', { token: tokens.student });
    assert.equal(courses.status, 200);
    assert.deepEqual(courses.body.courses.map(function (entry) { return entry.courseCode; }), [course.courseCode]);

    const invalidObject = await request('/student/feedback', {
      method: 'POST',
      token: tokens.student,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 5, communication: 4, punctuality: 3, engagement: 2 },
        comments: ''
      }
    });
    assert.equal(invalidObject.status, 400);

    const invalidRange = await request('/student/feedback', {
      method: 'POST',
      token: tokens.student,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 6, communication: 4, punctuality: 3, engagement: 2, subjectKnowledge: 1 }
      }
    });
    assert.equal(invalidRange.status, 400);

    const invalidFraction = await request('/student/feedback', {
      method: 'POST',
      token: tokens.student,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 4.5, communication: 4, punctuality: 3, engagement: 2, subjectKnowledge: 1 }
      }
    });
    assert.equal(invalidFraction.status, 400);

    const nonEnrolled = await request('/student/feedback', {
      method: 'POST',
      token: tokens.outsider,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 5, communication: 4, punctuality: 3, engagement: 2, subjectKnowledge: 1 }
      }
    });
    assert.equal(nonEnrolled.status, 404);

    const comments = `${student.name} ${student.email} ${String(student._id)} submitted this.`;
    const submitted = await request('/student/feedback', {
      method: 'POST',
      token: tokens.student,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 5, communication: 4, punctuality: 3, engagement: 2, subjectKnowledge: 1 },
        comments
      }
    });
    assert.equal(submitted.status, 201);
    submittedFeedbackId = submitted.body.feedback.id;

    const feedbackWithoutComment = await request('/student/feedback', {
      method: 'POST',
      token: tokens.outsider,
      body: {
        courseId: String(otherCourse._id),
        ratings: { clarity: 2, communication: 2, punctuality: 2, engagement: 2, subjectKnowledge: 2 }
      }
    });
    assert.equal(feedbackWithoutComment.status, 201);
    assert.equal(feedbackWithoutComment.body.feedback.comments, '');

    const duplicate = await request('/student/feedback', {
      method: 'POST',
      token: tokens.student,
      body: {
        courseId: String(course._id),
        ratings: { clarity: 5, communication: 4, punctuality: 3, engagement: 2, subjectKnowledge: 1 }
      }
    });
    assert.equal(duplicate.status, 409);

    const status = await request('/student/feedback/status', { token: tokens.student });
    assert.equal(status.status, 200);
    assert.equal(status.body.courses[0].submitted, true);

    const history = await request('/student/feedback', { token: tokens.student });
    assert.equal(history.status, 200);
    assert.equal(history.body.feedback.length, 1);
    assert.deepEqual(history.body.feedback[0].ratings, submitted.body.feedback.ratings);
  });

  await t.test('faculty sees assigned analytics and anonymized comments only', async function () {
    const assigned = await request('/faculty/courses', { token: tokens.faculty });
    assert.equal(assigned.status, 200);
    assert.deepEqual(assigned.body.courses.map(function (entry) { return entry.courseCode; }), [course.courseCode]);
    assert.equal(assigned.body.courses[0].responseCount, 1);
    assert.equal(JSON.stringify(assigned.body).includes(student.email), false);
    assert.equal(JSON.stringify(assigned.body).includes(String(student._id)), false);

    const analytics = await request(`/faculty/courses/${course._id}/analytics`, {
      token: tokens.faculty
    });
    assert.equal(analytics.status, 200);
    assert.deepEqual(analytics.body.feedbackComments, []);
    assert.deepEqual(analytics.body.feedbackTrend, []);
    assert.equal(analytics.body.privacy.minimumResponses, 5);
    assert.equal(analytics.body.privacy.commentsAvailable, false);
    const serialized = JSON.stringify(analytics.body);
    assert.equal(serialized.includes(student.name), false);
    assert.equal(serialized.includes(student.email), false);
    assert.equal(serialized.includes(String(student._id)), false);

    const additionalStudents = [];
    for (let index = 0; index < 4; index += 1) {
      additionalStudents.push(await createUser('Privacy Test Student ' + index, 'student'));
    }
    await Course.updateOne(
      { _id: course._id },
      { $addToSet: { enrolledStudents: { $each: additionalStudents.map(function (entry) { return entry._id; }) } } }
    );
    await Feedback.insertMany(additionalStudents.map(function (entry, index) {
      return {
        student: entry._id,
        course: course._id,
        ratings: { clarity: 4, communication: 4, punctuality: 4, engagement: 4, subjectKnowledge: 4 },
        comments: 'Helpful lecture; contact +1 (555) 010-234' + index
          + ', email ' + entry.email + ', student ID STU-2026000' + index
          + ', account @student_' + index + ', details https://example.test/' + entry._id
      };
    }));

    const eligibleAnalytics = await request(`/faculty/courses/${course._id}/analytics`, {
      token: tokens.faculty
    });
    assert.equal(eligibleAnalytics.status, 200);
    assert.equal(eligibleAnalytics.body.privacy.commentsAvailable, true);
    assert.equal(eligibleAnalytics.body.feedbackComments.length, 5);
    assert.deepEqual(eligibleAnalytics.body.feedbackTrend.map(function (entry) {
      return entry.responseCount;
    }), [5]);
    assert.equal(eligibleAnalytics.body.feedbackTrend[0].submittedAt, undefined);
    eligibleAnalytics.body.feedbackComments.forEach(function (entry) {
      assert.equal(entry.submittedAt, undefined);
      assert.equal(entry.averageRating, undefined);
      assert.match(entry.comment, /\[redacted/);
    });
    const eligibleSerialized = JSON.stringify(eligibleAnalytics.body);
    additionalStudents.forEach(function (entry) {
      assert.equal(eligibleSerialized.includes(entry.name), false);
      assert.equal(eligibleSerialized.includes(entry.email), false);
      assert.equal(eligibleSerialized.includes(String(entry._id)), false);
    });

    const otherFacultyAccess = await request(`/faculty/courses/${course._id}/analytics`, {
      token: tokens.otherFaculty
    });
    assert.equal(otherFacultyAccess.status, 404);

    const otherAssigned = await request('/faculty/courses', { token: tokens.otherFaculty });
    assert.deepEqual(otherAssigned.body.courses.map(function (entry) { return entry.courseCode; }), [otherCourse.courseCode]);

    const facultyDeleteAttempt = await request(`/admin/feedback/${submittedFeedbackId}`, {
      method: 'DELETE',
      token: tokens.faculty
    });
    assert.equal(facultyDeleteAttempt.status, 403);
  });

  await t.test('admin analytics, CRUD, assignments, enrollments, and feedback deletion', async function () {
    const reports = await request('/admin/analytics', { token: tokens.admin });
    assert.equal(reports.status, 200);
    assert.equal(typeof reports.body.overallAverage, 'number');
    assert.ok(Array.isArray(reports.body.coursePerformance));
    assert.ok(Array.isArray(reports.body.departmentPerformance));
    assert.ok(Array.isArray(reports.body.topFaculty));
    assert.ok(reports.body.topFaculty.length <= 5);
    assert.equal(reports.body.ratingDistribution.totalRatings, 30);
    assert.deepEqual(reports.body.ratingDistribution.overall.map(function (entry) {
      return entry.count;
    }), [1, 6, 1, 21, 1]);
    assert.equal(reports.body.ratingDistribution.byParameter.clarity[5], 1);

    const students = await request('/admin/students', { token: tokens.admin });
    const facultyList = await request('/admin/faculty', { token: tokens.admin });
    const courses = await request('/admin/courses', { token: tokens.admin });
    assert.equal(students.status, 200);
    assert.equal(facultyList.status, 200);
    assert.equal(courses.status, 200);
    assert.equal(JSON.stringify(students.body).includes('password'), false);

    const createdStudent = await request('/admin/students', {
      method: 'POST',
      token: tokens.admin,
      body: {
        name: 'Admin Created Student',
        email: emailFor('admin-created-student'),
        password,
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(createdStudent.status, 201);
    createdStudentId = createdStudent.body.user._id;
    createdUserIds.push(createdStudentId);

    const updatedStudent = await request(`/admin/students/${createdStudentId}`, {
      method: 'PATCH',
      token: tokens.admin,
      body: { name: 'Updated Test Student' }
    });
    assert.equal(updatedStudent.status, 200);
    assert.equal(updatedStudent.body.user.name, 'Updated Test Student');

    const createdFaculty = await request('/admin/faculty', {
      method: 'POST',
      token: tokens.admin,
      body: {
        name: 'Admin Created Faculty',
        email: emailFor('admin-created-faculty'),
        password,
        department: 'Test Engineering',
        semester: 'Test Term'
      }
    });
    assert.equal(createdFaculty.status, 201);
    createdFacultyId = createdFaculty.body.user._id;
    createdUserIds.push(createdFacultyId);

    const updatedFaculty = await request(`/admin/faculty/${createdFacultyId}`, {
      method: 'PATCH',
      token: tokens.admin,
      body: { department: 'Updated Engineering' }
    });
    assert.equal(updatedFaculty.status, 200);
    assert.equal(updatedFaculty.body.user.department, 'Updated Engineering');

    const createdCourse = await request('/admin/courses', {
      method: 'POST',
      token: tokens.admin,
      body: {
        courseName: 'Admin Created Course',
        courseCode: `NEW${runId}`,
        department: 'Test Engineering',
        semester: 'Test Term',
        facultyId: String(faculty._id)
      }
    });
    assert.equal(createdCourse.status, 201);
    createdCourseId = createdCourse.body.course._id;
    createdCourseIds.push(createdCourseId);

    const updatedCourse = await request(`/admin/courses/${createdCourseId}`, {
      method: 'PATCH',
      token: tokens.admin,
      body: { courseName: 'Updated Admin Course' }
    });
    assert.equal(updatedCourse.status, 200);
    assert.equal(updatedCourse.body.course.courseName, 'Updated Admin Course');

    const assignedFaculty = await request(`/admin/courses/${createdCourseId}/faculty`, {
      method: 'PATCH',
      token: tokens.admin,
      body: { facultyId: createdFacultyId }
    });
    assert.equal(assignedFaculty.status, 200);
    assert.equal(String(assignedFaculty.body.course.faculty._id), createdFacultyId);

    const enrolled = await request(`/admin/courses/${createdCourseId}/students`, {
      method: 'POST',
      token: tokens.admin,
      body: { studentId: createdStudentId }
    });
    assert.equal(enrolled.status, 201);

    const duplicateEnrollment = await request(`/admin/courses/${createdCourseId}/students`, {
      method: 'POST',
      token: tokens.admin,
      body: { studentId: createdStudentId }
    });
    assert.equal(duplicateEnrollment.status, 409);

    const removedEnrollment = await request(`/admin/courses/${createdCourseId}/students/${createdStudentId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(removedEnrollment.status, 200);

    const removedAgain = await request(`/admin/courses/${createdCourseId}/students/${createdStudentId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(removedAgain.status, 404);

    const assignedFacultyCannotDelete = await request(`/admin/faculty/${createdFacultyId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(assignedFacultyCannotDelete.status, 409);

    const unassignFaculty = await request(`/admin/courses/${createdCourseId}/faculty`, {
      method: 'PATCH',
      token: tokens.admin,
      body: { facultyId: String(faculty._id) }
    });
    assert.equal(unassignFaculty.status, 200);

    const deleteFaculty = await request(`/admin/faculty/${createdFacultyId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(deleteFaculty.status, 200);

    const deleteStudent = await request(`/admin/students/${createdStudentId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(deleteStudent.status, 200);

    const deleteCourse = await request(`/admin/courses/${createdCourseId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(deleteCourse.status, 200);

    const deleteFeedback = await request(`/admin/feedback/${submittedFeedbackId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(deleteFeedback.status, 200);

    const missingFeedback = await request(`/admin/feedback/${submittedFeedbackId}`, {
      method: 'DELETE',
      token: tokens.admin
    });
    assert.equal(missingFeedback.status, 404);
  });
});
