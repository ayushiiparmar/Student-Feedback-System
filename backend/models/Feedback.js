const mongoose = require('mongoose');

function ratingField(label) {
  return {
    type: Number,
    required: [true, `${label} rating is required.`],
    min: [1, `${label} rating must be at least 1.`],
    max: [5, `${label} rating must be at most 5.`],
    validate: {
      validator: Number.isInteger,
      message: `${label} rating must be an integer.`
    }
  };
}

const feedbackSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required.'],
      validate: {
        validator: async function (studentId) {
          return Boolean(await mongoose.model('User').exists({
            _id: studentId,
            role: 'student'
          }));
        },
        message: 'Student must reference an existing student user.'
      }
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required.'],
      validate: {
        validator: async function (courseId) {
          return Boolean(await mongoose.model('Course').exists({ _id: courseId }));
        },
        message: 'Course must reference an existing course.'
      }
    },
    ratings: {
      clarity: ratingField('Clarity'),
      communication: ratingField('Communication'),
      punctuality: ratingField('Punctuality'),
      engagement: ratingField('Engagement'),
      subjectKnowledge: ratingField('Subject knowledge')
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters.'],
      default: ''
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  { timestamps: true }
);

feedbackSchema.pre('validate', async function () {
  if (!this.student || !this.course) return;

  const course = await mongoose.model('Course')
    .findById(this.course)
    .select('enrolledStudents')
    .lean();

  if (!course) return;

  const studentIsEnrolled = course.enrolledStudents.some(function (studentId) {
    return studentId.equals(this.student);
  }, this);

  if (!studentIsEnrolled) {
    this.invalidate('student', 'Student must be enrolled in the course before submitting feedback.');
  }
});

feedbackSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
