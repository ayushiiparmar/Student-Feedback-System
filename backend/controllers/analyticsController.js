const Course = require('../models/Course');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const {
  average,
  ratingDistribution,
  roundRating,
  scoresFor,
  summarizeRatings
} = require('../utils/analytics');
const { ratingKeys } = require('../utils/validation');

async function getAdminAnalytics(request, response) {
  const [courses, feedback, faculty] = await Promise.all([
    Course.find().select('courseName courseCode department faculty').lean(),
    Feedback.find().select('course ratings').lean(),
    User.find({ role: 'faculty' }).select('_id name department').lean()
  ]);

  const coursesById = new Map(courses.map(function (course) {
    return [String(course._id), course];
  }));
  const feedbackByCourse = new Map();
  const feedbackByDepartment = new Map();
  const feedbackByFaculty = new Map();

  courses.forEach(function (course) {
    feedbackByCourse.set(String(course._id), []);
    if (!feedbackByDepartment.has(course.department)) feedbackByDepartment.set(course.department, []);
    if (!feedbackByFaculty.has(String(course.faculty))) feedbackByFaculty.set(String(course.faculty), []);
  });
  feedback.forEach(function (entry) {
    const course = coursesById.get(String(entry.course));
    if (!course) return;
    feedbackByCourse.get(String(course._id)).push(entry);
    feedbackByDepartment.get(course.department).push(entry);
    feedbackByFaculty.get(String(course.faculty)).push(entry);
  });

  const coursePerformance = courses.map(function (course) {
    const summary = summarizeRatings(feedbackByCourse.get(String(course._id)) || []);
    return {
      courseId: String(course._id),
      courseName: course.courseName,
      courseCode: course.courseCode,
      department: course.department,
      averageRating: summary.averageRating,
      responseCount: summary.responseCount,
      categoryAverages: summary.categoryAverages
    };
  });

  const departmentPerformance = Array.from(feedbackByDepartment.entries()).map(function (entry) {
    const scores = scoresFor(entry[1]);
    return {
      department: entry[0],
      averageRating: roundRating(average(scores)),
      responseCount: entry[1].length
    };
  }).sort(function (first, second) {
    return first.department.localeCompare(second.department);
  });

  const topFaculty = faculty.map(function (member) {
    const memberFeedback = feedbackByFaculty.get(String(member._id)) || [];
    return {
      facultyId: String(member._id),
      name: member.name,
      department: member.department,
      averageRating: roundRating(average(scoresFor(memberFeedback))),
      responseCount: memberFeedback.length
    };
  }).filter(function (member) {
    return member.averageRating !== null;
  }).sort(function (first, second) {
    return second.averageRating - first.averageRating || first.name.localeCompare(second.name);
  }).slice(0, 5);

  const parameterAverages = {};
  ratingKeys.forEach(function (key) {
    parameterAverages[key] = roundRating(average(feedback.map(function (entry) {
      return Number(entry.ratings[key]);
    })));
  });
  const overallScores = scoresFor(feedback);

  response.json({
    totals: {
      students: await User.countDocuments({ role: 'student' }),
      faculty: faculty.length,
      courses: courses.length,
      feedbackSubmissions: feedback.length
    },
    overallAverage: roundRating(average(overallScores)),
    parameterAverages,
    ratingDistribution: ratingDistribution(feedback),
    coursePerformance,
    departmentPerformance,
    topFaculty
  });
}

module.exports = { getAdminAnalytics };
