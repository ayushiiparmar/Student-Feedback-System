require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { getJwtSecret } = require('./utils/jwt');

const port = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    getJwtSecret();
    const hasFrontendOrigin = (process.env.FRONTEND_URL || '')
      .split(',')
      .some(function (origin) { return origin.trim().length > 0; });
    if (process.env.NODE_ENV === 'production' && !hasFrontendOrigin) {
      throw new Error('FRONTEND_URL must be set in production.');
    }
    await connectDB();
    const server = app.listen(port, function () {
      console.log(`Student Feedback API listening on port ${port}.`);
    });
    server.on('error', function (error) {
      console.error(`HTTP server failed: ${error.message}`);
      process.exitCode = 1;
    });
    return server;
  } catch (error) {
    if (error.message.startsWith('JWT_SECRET') || error.message.startsWith('FRONTEND_URL')) {
      console.error(error.message);
    } else {
      console.error('Backend startup failed. See the MongoDB connection error above.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) startServer();

module.exports = startServer;
