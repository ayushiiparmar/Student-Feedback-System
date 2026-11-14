const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    courseName: {
      type: String,
      required: [true, 'Course name is required.'],
      trim: true
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required.'],
      unique: true,
      uppercase: true,
      trim: true
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      trim: true
    },
    semester: {
      type: String,
      required: [true, 'Semester is required.'],
      trim: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An assigned faculty member is required.'],
      validate: {
        validator: async function (facultyId) {
          return Boolean(await mongoose.model('User').exists({
            _id: facultyId,
            role: 'faculty'
          }));
        },
        message: 'Assigned faculty must reference an existing faculty user.'
      }
    },
    enrolledStudents: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      default: [],
      validate: {
        validator: async function (studentIds) {
          const uniqueIds = new Set(studentIds.map(String));
          if (uniqueIds.size !== studentIds.length) return false;
          if (studentIds.length === 0) return true;

          const validStudentCount = await mongoose.model('User').countDocuments({
            _id: { $in: studentIds },
            role: 'student'
          });
          return validStudentCount === studentIds.length;
        },
        message: 'Enrolled students must be unique references to existing student users.'
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
