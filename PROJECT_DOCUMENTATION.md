# Student Feedback and Evaluation System

## Project overview

**Institution branding:** SR University  
**Project type:** College-level web application prototype  
**Scope:** Local-development frontend and REST API backed by MongoDB. This is not a production deployment.

### Problem statement

Collecting consistent feedback about teaching and courses helps a university understand student experience and identify areas for improvement. This system lets enrolled students submit structured, one-per-course evaluations; gives faculty access to scoped, privacy-filtered feedback summaries; and lets administrators manage academic records and review institution-wide analytics.

### Objectives

- Provide a simple student registration and login flow.
- Show students their enrolled courses, assigned faculty, and feedback status.
- Collect five required ratings and optional comments once per student per course.
- Give faculty analytics only for courses assigned to them, without student identity fields.
- Let administrators manage students, faculty, courses, and course mappings.
- Summarize course, department, parameter, and faculty performance.
- Keep the sample application easy to run locally without a production backend service.

## Technologies

| Area | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Charts | Chart.js |
| Backend | Node.js, Express 5 |
| Database access | MongoDB, Mongoose |
| Password hashing | bcryptjs |
| Authentication | JSON Web Tokens (`jsonwebtoken`) |
| Configuration | `dotenv` |
| Local development | VS Code Live Server and MongoDB Community Server |

Dependency versions and scripts are defined in [`backend/package.json`](./backend/package.json) and locked in `backend/package-lock.json`.

## System architecture

```text
Browser
  ├─ Static pages, styles, and vanilla JavaScript (frontend/)
  ├─ Chart.js renders API-provided analytics
  └─ JSON requests to http://127.0.0.1:5000/api
       ↓
Express application (backend/app.js)
  ├─ Routes: auth, student, faculty, admin, analytics
  ├─ Authentication and role middleware
  ├─ Controllers: validation, permissions, and application logic
  └─ Mongoose models
       ↓
MongoDB: studentFeedbackDB
```

The browser stores the login token and current user in `sessionStorage`. The backend verifies the token and retrieves the account and role for protected requests. `frontend/config.js` points to `http://127.0.0.1:5000/api` for local use. The Render static build regenerates that file from the public `API_BASE_URL` build variable; database credentials and JWT secrets are never placed in the frontend.

### Project structure

```text
Student-Feedback-System/
├── README.md
├── PROJECT_DOCUMENTATION.md
├── DEMO_GUIDE.md
├── DEPLOYMENT_GUIDE.md
├── frontend/
│   ├── index.html
│   ├── student.html
│   ├── faculty.html
│   ├── admin.html
│   ├── style.css
│   ├── script.js
│   ├── config.js
│   ├── build-config.js
│   └── assets/
└── backend/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    ├── README.md
    ├── app.js
    ├── server.js
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── scripts/
    ├── tests/
    └── utils/
```

## Database collections and relationships

Mongoose uses the collections `users`, `courses`, and `feedbacks`.

### `users`

- `name`, unique normalized `email`, bcrypt-hashed `password`
- `role`: `student`, `faculty`, or `admin`
- `department`, `semester`
- Mongoose `createdAt` and `updatedAt` timestamps

Passwords are excluded from normal queries and JSON responses.

### `courses`

- `courseName`, unique uppercase `courseCode`
- `department`, `semester`
- `faculty`: reference to a faculty `User`
- `enrolledStudents`: array of student `User` references
- Mongoose timestamps

### `feedbacks`

- `student`: reference to the submitting student `User`
- `course`: reference to the evaluated `Course`
- `ratings`: required integer values from 1 to 5 for `clarity`, `communication`, `punctuality`, `engagement`, and `subjectKnowledge`
- `comments`: optional trimmed text, up to 1,000 characters
- `submittedAt` plus Mongoose timestamps

A course points to its faculty member and enrolled students. A feedback record points to one student and one course. The database enforces a unique compound index on `{ student, course }`, and feedback validation checks that the student is enrolled in that course.

## Modules and functionality

### Student

- Register as a student and log in.
- View profile, enrolled courses, and assigned faculty.
- See feedback submission status per course.
- Submit five required 1–5 ratings and optional comments.
- View their own feedback history.
- Submitted feedback is treated as read-only; duplicate student/course submissions are rejected by the backend and database index.

### Faculty

- View only courses assigned to the authenticated faculty account.
- View course averages and category-wise analytics.
- View aggregated feedback trends and privacy-eligible anonymous comments.
- Faculty API responses do not include student records or student reference IDs.

### Administrator

- Manage student and faculty accounts.
- Create, edit, and delete courses.
- Assign faculty to courses and enroll or unenroll students.
- Delete feedback records as an administrator.
- Review overall, parameter, course, department, faculty-ranking, and rating-distribution analytics.
- Export the report from the browser as CSV.

### Rating color bands

- **Green — Excellent:** 4.5–5
- **Yellow — Average:** 3–4.4
- **Red — Needs Improvement:** below 3

## API endpoint catalog

Protected endpoints require `Authorization: Bearer <JWT>`. Role restrictions are enforced by backend middleware.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | API health check |
| `POST` | `/api/auth/register` | Public | Register a student; public registration cannot select another role |
| `POST` | `/api/auth/login` | Public | Log in as a student, faculty member, or admin |
| `GET` | `/api/student/profile` | Student | Get the authenticated student profile |
| `GET` | `/api/student/courses` | Student | Get enrolled courses and assigned faculty |
| `GET` | `/api/student/feedback/status` | Student | Get per-course submission status |
| `GET` | `/api/student/feedback` | Student | Get the authenticated student's own submitted feedback |
| `POST` | `/api/student/feedback` | Student | Submit feedback for an enrolled course |
| `GET` | `/api/faculty/courses` | Faculty | Get assigned courses and summary averages |
| `GET` | `/api/faculty/courses/:courseId/analytics` | Faculty | Get analytics/comments for an assigned course |
| `GET` / `POST` | `/api/admin/students` | Admin | List or create students |
| `PATCH` / `DELETE` | `/api/admin/students/:id` | Admin | Update or delete a student |
| `GET` / `POST` | `/api/admin/faculty` | Admin | List or create faculty |
| `PATCH` / `DELETE` | `/api/admin/faculty/:id` | Admin | Update or delete a faculty member |
| `GET` / `POST` | `/api/admin/courses` | Admin | List or create courses |
| `PATCH` / `DELETE` | `/api/admin/courses/:id` | Admin | Update or delete a course |
| `PATCH` | `/api/admin/courses/:id/faculty` | Admin | Assign a faculty member to a course |
| `POST` | `/api/admin/courses/:id/students` | Admin | Enroll a student in a course |
| `DELETE` | `/api/admin/courses/:id/students/:studentId` | Admin | Remove a student enrollment; blocked if feedback exists |
| `DELETE` | `/api/admin/feedback/:id` | Admin | Delete a feedback record |
| `GET` | `/api/admin/analytics` | Admin | Get overall and department/course/faculty analytics and rating distribution |

Feedback submission body:

```json
{
  "courseId": "course MongoDB id",
  "ratings": {
    "clarity": 5,
    "communication": 4,
    "punctuality": 5,
    "engagement": 4,
    "subjectKnowledge": 5
  },
  "comments": "Optional feedback"
}
```

The `comments` property may be omitted or empty. The five rating properties are required and must be integers from 1 to 5. There is no backend report-file export endpoint; the admin interface creates a CSV download in the browser from the analytics data.

## Authentication, security, and privacy

- Passwords are hashed with bcryptjs using 12 salt rounds.
- JWTs contain the account subject and expire according to `JWT_EXPIRES_IN` (default `1d`).
- Registration always creates a student; privileged roles are managed by an administrator.
- Protected routes verify the token, load the current user, and enforce the role on the server.
- Server-side checks enforce role access, assigned-course scope, student enrollment, and rating validity.
- The database unique index prevents more than one feedback record for the same student/course pair.
- Normal user serialization omits password hashes. Faculty analytics omit student records and student IDs.
- Faculty comments are withheld unless a course has at least five feedback submissions **and** at least five non-empty comments. Published comments omit per-response dates and ratings. Monthly trend points are only included for months with at least five responses.
- Comment sanitization redacts registered identities and common contact/account/ID patterns. Free-text redaction is heuristic: indirect clues may remain, so this is not a guarantee of anonymity or suitable as a production privacy control.
- CORS allows local origins only outside production. In production, the backend requires `FRONTEND_URL` and allows only the configured frontend origins. Use HTTPS, managed secrets, rate limiting, monitoring, and a reviewed privacy policy before inviting real users.

## Exact local start commands

These are Windows PowerShell commands for the current project folder. Use only a local development database.

### 1. Start and verify MongoDB

```powershell
Get-Service MongoDB
Start-Service MongoDB
mongosh --quiet "mongodb://127.0.0.1:27017/studentFeedbackDB" --eval "db.adminCommand({ ping: 1 })"
```

Run `Start-Service` only if the service is stopped; starting the Windows service may require an elevated PowerShell terminal. The example URI selects database `studentFeedbackDB`.

### 2. Configure and start the backend

From the project root:

```powershell
Set-Location "D:\Desktop\hacathon sem3\Student-Feedback-System\backend"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
```

Edit `backend/.env` and set `JWT_SECRET` to a private random value of at least 32 characters. To generate a value locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Do not commit or share the generated secret or `.env`. For a disposable development database, seed the demo records and start the server:

```powershell
npm run seed
npm start
```

The API listens on port `5000`. Keep this terminal open. From another PowerShell terminal, verify it with:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

`npm run seed` inserts or updates the named demo accounts, five demo courses, their enrollments, and listed feedback records. It does **not** remove unrelated records. It resets the seeded course enrollments and updates matching seeded feedback, so only use it with a development database.

### 3. Start the frontend

Open `frontend/index.html` in VS Code, right-click the editor, and choose **Open with Live Server**. Leave Live Server and the API running. The frontend calls `http://127.0.0.1:5000/api`.

### Run the backend tests

With MongoDB running and the backend `.env` configured, open a backend terminal and run:

```powershell
npm test
```

The API integration tests use `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017/studentFeedbackTestDB`). The bootstrap test uses a separate local `studentFeedbackBootstrapTestDB` and drops that dedicated test database after the test. Neither test database should contain production data.

## Seeded demo credentials

The seed script sets the password `demo123` for every seeded account. These accounts are for local demonstration only.

| Role | Email | Password |
| --- | --- | --- |
| Student | `aarav.kumar@sru.edu.in` | `demo123` |
| Faculty | `priya.menon@sru.edu.in` | `demo123` |
| Admin | `riya.sharma@sru.edu.in` | `demo123` |

Do not reuse these credentials for real accounts or public deployments.

## Local-development limitations

- MongoDB, the Express server, and the static frontend must be started separately on the same development machine.
- The checked-in frontend config defaults to `http://127.0.0.1:5000/api`; deployment requires building with `API_BASE_URL`.
- Chart.js is loaded in the frontend; an internet connection may be needed if the browser has not cached the CDN asset.
- The project uses demo credentials and local HTTP, not production identity management or transport security.
- Comment anonymization is heuristic and cannot guarantee that free text contains no identifying clue.
- The CSV export is generated by the browser; there is no server-side report file or scheduled export.
- No production deployment, hosted database, backup/restore process, monitoring, rate limiting, or security certification is included.

The deployment preparation and remaining hosted setup steps are documented in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

