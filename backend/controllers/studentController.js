const Course = require('../models/Course');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const {
  assertAllowedKeys,
  validateObjectId,
  validateRatings
} = require('../utils/validation');

async function getProfile(request, response) {
  response.json({ user: request.user });
}

async function getEnrolledCourses(request, response) {
  const courses = await Course.find({ enrolledStudents: request.user._id })
    .select('courseName courseCode department semester faculty')
    .populate('faculty', 'name email department')
    .lean();

  response.json({ courses });
}

async function getFeedbackStatus(request, response) {
  const courses = await Course.find({ enrolledStudents: request.user._id })
    .select('courseName courseCode department semester faculty')
    .populate('faculty', 'name email department')
    .lean();
  const courseIds = courses.map(function (course) { return course._id; });
  const submittedFeedback = courseIds.length
    ? await Feedback.find({ student: request.user._id, course: { $in: courseIds } })
      .select('course submittedAt')
      .lean()
    : [];
  const feedbackByCourse = new Map(submittedFeedback.map(function (entry) {
    return [String(entry.course), entry];
  }));

  response.json({
    courses: courses.map(function (course) {
      const feedback = feedbackByCourse.get(String(course._id));
      return {
        course,
        submitted: Boolean(feedback),
        submittedAt: feedback ? feedback.submittedAt : null
      };
    })
  });
}

async function getOwnFeedback(request, response) {
  const feedback = await Feedback.find({ student: request.user._id })
    .select('course ratings comments submittedAt')
    .populate('course', 'courseName courseCode')
    .sort({ submittedAt: -1 })
    .lean();

  response.json({
    feedback: feedback.map(function (entry) {
      return {
        id: String(entry._id),
        course: entry.course ? {
          id: String(entry.course._id),
          courseName: entry.course.courseName,
          courseCode: entry.course.courseCode
        } : null,
        ratings: entry.ratings,
        comments: entry.comments,
        submittedAt: entry.submittedAt
      };
    })
  });
}

async function submitFeedback(request, response) {
  assertAllowedKeys(request.body, ['courseId', 'ratings', 'comments']);

  const courseId = validateObjectId(request.body.courseId, 'Course ID');
  const ratings = validateRatings(request.body.ratings);
  let comments = '';
  if (request.body.comments !== undefined) {
    if (typeof request.body.comments !== 'string') {
      throw new ApiError(400, 'Comments must be a string.');
    }
    comments = request.body.comments.trim();
    if (comments.length > 1000) throw new ApiError(400, 'Comments cannot exceed 1000 characters.');
  }

  const course = await Course.findOne({
    _id: courseId,
    enrolledStudents: request.user._id
  }).select('courseName courseCode');
  if (!course) throw new ApiError(404, 'Course not found or you are not enrolled.');

  if (await Feedback.exists({ student: request.user._id, course: course._id })) {
    throw new ApiError(409, 'Feedback has already been submitted for this course.');
  }

  const feedback = await Feedback.create({
    student: request.user._id,
    course: course._id,
    ratings,
    comments
  });

  response.status(201).json({
    message: 'Feedback submitted successfully.',
    feedback: {
      id: String(feedback._id),
      course: { id: String(course._id), courseName: course.courseName, courseCode: course.courseCode },
      ratings: feedback.ratings,
      comments: feedback.comments,
      submittedAt: feedback.submittedAt
    }
  });
}

module.exports = { getEnrolledCourses, getFeedbackStatus, getOwnFeedback, getProfile, submitFeedback };
