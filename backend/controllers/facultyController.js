const Course = require('../models/Course');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const anonymizeComment = require('../utils/anonymizeComment');
const { average, roundRating, summarizeRatings } = require('../utils/analytics');
const { validateObjectId } = require('../utils/validation');

const MINIMUM_ANONYMOUS_RESPONSES = 5;

function buildFeedbackTrend(feedback) {
  const months = new Map();
  feedback.forEach(function (entry) {
    const date = new Date(entry.submittedAt);
    const key = date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
    if (!months.has(key)) {
      months.set(key, {
        period: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
          + ' ' + date.getUTCFullYear(),
        ratingTotal: 0,
        responseCount: 0
      });
    }
    const month = months.get(key);
    month.ratingTotal += Object.values(entry.ratings).reduce(function (sum, rating) {
      return sum + Number(rating);
    }, 0);
    month.responseCount += 1;
  });

  return Array.from(months.entries())
    .sort(function (first, second) { return first[0].localeCompare(second[0]); })
    .map(function (entry) { return entry[1]; })
    .filter(function (month) { return month.responseCount >= MINIMUM_ANONYMOUS_RESPONSES; })
    .map(function (month) {
      return {
        period: month.period,
        responseCount: month.responseCount,
        averageRating: roundRating(month.ratingTotal / (month.responseCount * 5))
      };
    });
}

async function getAssignedCourses(request, response) {
  const courses = await Course.find({ faculty: request.user._id })
    .select('courseName courseCode department semester enrolledStudents')
    .lean();
  const courseIds = courses.map(function (course) { return course._id; });
  const feedback = courseIds.length
    ? await Feedback.find({ course: { $in: courseIds } }).select('course ratings').lean()
    : [];
  const feedbackByCourse = new Map();
  feedback.forEach(function (entry) {
    const key = String(entry.course);
    if (!feedbackByCourse.has(key)) feedbackByCourse.set(key, []);
    feedbackByCourse.get(key).push(entry);
  });

  response.json({
    courses: courses.map(function (course) {
      const summary = summarizeRatings(feedbackByCourse.get(String(course._id)) || []);
      return {
        id: String(course._id),
        courseName: course.courseName,
        courseCode: course.courseCode,
        department: course.department,
        semester: course.semester,
        enrolledCount: course.enrolledStudents.length,
        ...summary
      };
    })
  });
}

async function getCourseAnalytics(request, response) {
  const courseId = validateObjectId(request.params.courseId, 'Course ID');
  const course = await Course.findOne({ _id: courseId, faculty: request.user._id })
    .select('courseName courseCode department semester enrolledStudents')
    .lean();
  if (!course) throw new ApiError(404, 'Assigned course not found.');

  const feedback = await Feedback.find({ course: course._id })
      .select('ratings comments submittedAt')
      .sort({ submittedAt: -1 })
      .lean();
  const summary = summarizeRatings(feedback);
  const comments = feedback.filter(function (entry) {
    return typeof entry.comments === 'string' && entry.comments.trim().length > 0;
  });
  const commentsAvailable = feedback.length >= MINIMUM_ANONYMOUS_RESPONSES
    && comments.length >= MINIMUM_ANONYMOUS_RESPONSES;
  const students = commentsAvailable
    ? await User.find({ _id: { $in: course.enrolledStudents }, role: 'student' })
      .select('_id name email studentId')
      .lean()
    : [];
  const feedbackComments = commentsAvailable
    ? comments.map(function (entry) {
      return { comment: anonymizeComment(entry.comments, students) };
    }).sort(function (first, second) {
      return first.comment.localeCompare(second.comment);
    })
    : [];

  response.json({
    course: {
      id: String(course._id),
      courseName: course.courseName,
      courseCode: course.courseCode,
      department: course.department,
      semester: course.semester
    },
    ...summary,
    privacy: {
      minimumResponses: MINIMUM_ANONYMOUS_RESPONSES,
      commentsAvailable,
      trendsMinimumResponses: MINIMUM_ANONYMOUS_RESPONSES
    },
    feedbackComments,
    feedbackTrend: buildFeedbackTrend(feedback)
  });
}

module.exports = { getAssignedCourses, getCourseAnalytics };
