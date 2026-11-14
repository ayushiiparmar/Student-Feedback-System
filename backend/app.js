const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();
const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map(function (origin) { return origin.trim().replace(/\/+$/, ''); })
    .filter(Boolean)
);
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin(origin, callback) {
    const isLocalOrigin = typeof origin === 'string'
      && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);

    if (!origin || allowedOrigins.has(origin) || (isDevelopment && (isLocalOrigin || origin === 'null'))) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, 'Origin is not allowed by CORS.'));
  },
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', function (request, response) {
  response.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
