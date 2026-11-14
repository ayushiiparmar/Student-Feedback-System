require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Feedback = require('../models/Feedback');

const semester = 'Fall 2026';
const demoPassword = 'demo123';

const studentData = [
  { name: 'Aarav Kumar', email: 'aarav.kumar@sru.edu.in', department: 'Computer Science & Engineering' },
  { name: 'Saanvi Patel', email: 'saanvi.patel@sru.edu.in', department: 'Electronics' },
  { name: 'Rohan Verma', email: 'rohan.verma@sru.edu.in', department: 'Information Technology' },
  { name: 'Meera Iyer', email: 'meera.iyer@sru.edu.in', department: 'Computer Science & Engineering' },
  { name: 'Arjun Singh', email: 'arjun.singh@sru.edu.in', department: 'Mechanical Engineering' },
  { name: 'Kavya Nair', email: 'kavya.nair@sru.edu.in', department: 'Business' },
  { name: 'Dev Malhotra', email: 'dev.malhotra@sru.edu.in', department: 'Electronics' },
  { name: 'Isha Rao', email: 'isha.rao@sru.edu.in', department: 'Mechanical Engineering' },
  { name: 'Nikhil Reddy', email: 'nikhil.reddy@sru.edu.in', department: 'Mathematics' },
  { name: 'Tanvi Shah', email: 'tanvi.shah@sru.edu.in', department: 'Business' }
];

const facultyData = [
  { name: 'Dr. Priya Menon', email: 'priya.menon@sru.edu.in', department: 'Computer Science & Engineering' },
  { name: 'Prof. Kiran Joshi', email: 'kiran.joshi@sru.edu.in', department: 'Electronics' },
  { name: 'Dr. Neha Reddy', email: 'neha.reddy@sru.edu.in', department: 'Mathematics' },
  { name: 'Dr. Ananya Shah', email: 'ananya.shah@sru.edu.in', department: 'Business' },
  { name: 'Prof. Vikram Das', email: 'vikram.das@sru.edu.in', department: 'Mechanical Engineering' }
];

const courseData = [
  { courseName: 'Data Structures and Algorithms', courseCode: 'CSE301', department: 'Computer Science & Engineering', facultyEmail: 'priya.menon@sru.edu.in', studentIndexes: [0, 1, 2, 3] },
  { courseName: 'Digital Electronics', courseCode: 'ECE215', department: 'Electronics', facultyEmail: 'kiran.joshi@sru.edu.in', studentIndexes: [1, 5, 6, 8] },
  { courseName: 'Applied Mathematics III', courseCode: 'MAT221', department: 'Mathematics', facultyEmail: 'neha.reddy@sru.edu.in', studentIndexes: [0, 4, 8, 9] },
  { courseName: 'Principles of Marketing', courseCode: 'MBA211', department: 'Business', facultyEmail: 'ananya.shah@sru.edu.in', studentIndexes: [0, 5, 8, 9] },
  { courseName: 'Thermodynamics', courseCode: 'ME301', department: 'Mechanical Engineering', facultyEmail: 'vikram.das@sru.edu.in', studentIndexes: [2, 4, 6, 7] }
];

const feedbackData = [
  { studentIndex: 0, courseCode: 'CSE301', ratings: [5, 4, 5, 4, 5], comments: 'Worked examples make the core concepts easy to follow.', daysAgo: 12 },
  { studentIndex: 1, courseCode: 'CSE301', ratings: [4, 4, 4, 5, 4], comments: 'The practical problem-solving sessions are helpful.', daysAgo: 9 },
  { studentIndex: 2, courseCode: 'CSE301', ratings: [5, 5, 4, 5, 5], comments: 'Clear explanations and a welcoming environment for questions.', daysAgo: 6 },
  { studentIndex: 3, courseCode: 'CSE301', ratings: [4, 5, 4, 4, 5], comments: '', daysAgo: 3 },
  { studentIndex: 5, courseCode: 'ECE215', ratings: [4, 4, 4, 3, 4], comments: 'A slower walkthrough of the first circuit examples would help.', daysAgo: 10 },
  { studentIndex: 6, courseCode: 'ECE215', ratings: [5, 4, 5, 4, 5], comments: 'Lab demonstrations connect theory to practical work.', daysAgo: 4 },
  { studentIndex: 4, courseCode: 'MAT221', ratings: [3, 4, 3, 3, 4], comments: 'Weekly review problems help reinforce the material.', daysAgo: 14 },
  { studentIndex: 9, courseCode: 'MAT221', ratings: [4, 4, 4, 4, 4], comments: '', daysAgo: 7 },
  { studentIndex: 8, courseCode: 'MBA211', ratings: [5, 5, 4, 5, 5], comments: 'Case studies make the sessions engaging and relevant.', daysAgo: 8 },
  { studentIndex: 7, courseCode: 'ME301', ratings: [4, 5, 4, 4, 5], comments: 'The demonstrations connect theory to real applications.', daysAgo: 5 }
];

async function saveSeedUser(userData, role) {
  let user = await User.findOne({ email: userData.email });
  if (!user) user = new User({ email: userData.email });

  user.name = userData.name;
  user.email = userData.email;
  user.password = demoPassword;
  user.role = role;
  user.department = userData.department;
  user.semester = semester;
  await user.save();
  return user;
}

async function seedDatabase() {
  await connectDB();
  await Promise.all([User.init(), Course.init(), Feedback.init()]);

  const students = [];
  for (const student of studentData) {
    students.push(await saveSeedUser(student, 'student'));
  }

  const faculty = [];
  for (const member of facultyData) {
    faculty.push(await saveSeedUser(member, 'faculty'));
  }

  const admin = await saveSeedUser({
    name: 'Riya Sharma',
    email: 'riya.sharma@sru.edu.in',
    department: 'Administration'
  }, 'admin');

  const coursesByCode = new Map();
  for (const courseEntry of courseData) {
    const facultyMember = faculty.find(function (member) {
      return member.email === courseEntry.facultyEmail;
    });
    const enrolledStudents = courseEntry.studentIndexes.map(function (index) {
      return students[index]._id;
    });

    let course = await Course.findOne({ courseCode: courseEntry.courseCode });
    if (!course) course = new Course({ courseCode: courseEntry.courseCode });

    course.courseName = courseEntry.courseName;
    course.courseCode = courseEntry.courseCode;
    course.department = courseEntry.department;
    course.semester = semester;
    course.faculty = facultyMember._id;
    course.enrolledStudents = enrolledStudents;
    await course.save();
    coursesByCode.set(course.courseCode, course);
  }

  let feedbackCount = 0;
  for (const feedbackEntry of feedbackData) {
    const student = students[feedbackEntry.studentIndex];
    const course = coursesByCode.get(feedbackEntry.courseCode);
    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - feedbackEntry.daysAgo);

    let feedback = await Feedback.findOne({ student: student._id, course: course._id });
    if (!feedback) {
      feedback = new Feedback({ student: student._id, course: course._id });
    }

    feedback.ratings = {
      clarity: feedbackEntry.ratings[0],
      communication: feedbackEntry.ratings[1],
      punctuality: feedbackEntry.ratings[2],
      engagement: feedbackEntry.ratings[3],
      subjectKnowledge: feedbackEntry.ratings[4]
    };
    feedback.comments = feedbackEntry.comments;
    feedback.submittedAt = submittedAt;
    await feedback.save();
    feedbackCount += 1;
  }

  console.log('Demo data seeded successfully.');
  console.log(`Users: ${students.length} students, ${faculty.length} faculty, 1 admin (${admin.email}).`);
  console.log(`Courses: ${coursesByCode.size}. Feedback records: ${feedbackCount}.`);
  console.log(`Demo password for all seeded accounts: ${demoPassword}`);
}

seedDatabase()
  .catch(function (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async function () {
    await mongoose.disconnect();
  });
