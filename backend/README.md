# Student Feedback System API

This backend provides the REST API used by the vanilla HTML/CSS/JavaScript frontend. It uses Express, Mongoose, MongoDB, bcryptjs, and JWT.

## Setup and run

From this directory in PowerShell:

```powershell
Copy-Item .env.example .env
npm install
```

Edit `.env` and replace the `JWT_SECRET` placeholder with a private random value of at least 32 characters. Keep `.env` out of source control. The local MongoDB service must be running; the example URI connects to `studentFeedbackDB`.

Start the API:

```powershell
npm start
```

The server listens on port `5000` by default. `GET /api/health` is a public health check. Seeded demo accounts use `demo123`; use these only for local development.

Run the frontend separately with VS Code Live Server by opening `frontend/index.html`. The frontend calls `http://127.0.0.1:5000/api`; keep the backend running in its own terminal.

## API tests

With MongoDB running, execute `npm test` from this directory. The API integration suite starts the Express app on a temporary local port and uses `MONGODB_TEST_URI` (default: `studentFeedbackTestDB`), separate from the application database. The bootstrap test uses a dedicated local `studentFeedbackBootstrapTestDB` and drops it after the test. Keep test database URIs separate from production data.

## Authentication

- `POST /api/auth/register` — public student registration. The role is always `student`.
- `POST /api/auth/login` — returns a JWT and safe user profile.

For protected routes, send `Authorization: Bearer <token>`. The server loads the user and role from MongoDB for every request; roles cannot be selected through public registration.

## Student routes

All routes require the `student` role:

- `GET /api/student/profile`
- `GET /api/student/courses`
- `GET /api/student/feedback/status`
- `GET /api/student/feedback` — read-only details of the authenticated student's own submissions.
- `POST /api/student/feedback` with `{ "courseId": "...", "ratings": { "clarity": 1, "communication": 1, "punctuality": 1, "engagement": 1, "subjectKnowledge": 1 }, "comments": "optional" }`

Feedback is accepted only for an enrolled course, has exactly five integer ratings from 1 to 5, and is limited by the unique student/course index.

## Faculty routes

All routes require the `faculty` role and are scoped to courses assigned to the authenticated faculty member:

- `GET /api/faculty/courses` — assigned course summaries, averages, and category ratings.
- `GET /api/faculty/courses/:courseId/analytics` — category analytics, privacy-thresholded anonymous comments, and aggregated feedback trends for one assigned course.

Faculty responses do not include student records or student reference IDs. Comments are withheld unless a course has at least five feedback submissions and five non-empty comments. Published comments omit per-response dates and ratings; monthly trend points are included only for months with at least five responses. Registered student names/emails, phone numbers, links, account handles, and common student-ID patterns are redacted. Free-text redaction remains heuristic; indirect identity clues may remain, so this is not a production anonymity guarantee.

## Admin routes

All routes below require the `admin` role:

- Students: `GET|POST /api/admin/students`, `PATCH|DELETE /api/admin/students/:id`
- Faculty: `GET|POST /api/admin/faculty`, `PATCH|DELETE /api/admin/faculty/:id`
- Courses: `GET|POST /api/admin/courses`, `PATCH|DELETE /api/admin/courses/:id`
- Faculty assignment: `PATCH /api/admin/courses/:id/faculty` with `{ "facultyId": "..." }`
- Student enrollment: `POST /api/admin/courses/:id/students` with `{ "studentId": "..." }`
- Student unenrollment: `DELETE /api/admin/courses/:id/students/:studentId` (blocked when feedback exists)
- Feedback deletion: `DELETE /api/admin/feedback/:id`
- Analytics: `GET /api/admin/analytics`

Admin analytics includes overall and parameter averages, course and department performance, the top five faculty members with feedback, and `ratingDistribution` (pooled rating counts and percentages plus counts by parameter). There is no report-file export endpoint yet; analytics are returned as JSON.

Admin create-user bodies require `name`, `email`, `password`, `department`, and `semester`. The role is assigned by the endpoint, not by request data. Course creation requires `courseName`, `courseCode`, `department`, `semester`, and `facultyId`; `enrolledStudentIds` is optional.

## Collections

- `users` stores student, faculty, and admin accounts; passwords are bcrypt hashes and are excluded from normal queries/responses.
- `courses` stores faculty and enrolled-student references.
- `feedbacks` stores the five required ratings, optional comments, and student/course references. The unique `{ student, course }` index prevents duplicate submissions.

## Render production configuration

For deployment, use this folder as the Render Web Service root directory. Set the build command to `npm ci` and the start command to `npm start`. Render supplies `PORT`; `server.js` listens on it. Configure `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `FRONTEND_URL` in the Render service environment. The health-check path is `/api/health`.

`FRONTEND_URL` is a comma-separated list of exact frontend origins (for example `https://your-site.onrender.com`). Production CORS rejects unlisted origins; local `localhost`/`127.0.0.1` origins are accepted only outside production. Never put Atlas credentials or `JWT_SECRET` in frontend files.

The API is a local-development prototype, not production authentication. Before inviting real users, use HTTPS, a managed secret, restricted Atlas network access, rate limiting, monitoring, and an institution-approved privacy policy. Do not run the demo `npm run seed` command against production data.

See the project-root [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for Atlas setup, the Render Static Site configuration, initial admin creation, and hosted smoke tests.
