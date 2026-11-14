const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.']
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      select: false
    },
    role: {
      type: String,
      required: [true, 'Role is required.'],
      enum: ['student', 'faculty', 'admin']
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
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, result) {
        delete result.password;
        return result;
      }
    }
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

module.exports = mongoose.model('User', userSchema);
