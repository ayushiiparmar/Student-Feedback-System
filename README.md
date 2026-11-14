# Student Feedback and Evaluation System

Vanilla HTML, CSS, and JavaScript frontend with an Express, MongoDB, and Mongoose API. This guide is for running the project locally; it is not a public production deployment guide.

## Requirements

- Node.js 20.19.0 or newer and npm
- MongoDB Community Server running locally
- VS Code with the Live Server extension

To check or start the MongoDB Windows service from PowerShell, run:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

Run `Start-Service` only if the service is stopped; it may require an elevated PowerShell terminal. Verify the local database listener with:

```powershell
mongosh --quiet "mongodb://127.0.0.1:27017/studentFeedbackDB" --eval "db.adminCommand({ ping: 1 })"
```

## 1. Configure and start the backend

Open the project folder in VS Code. In a PowerShell terminal, run:

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
```

Generate a private JWT secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Open `backend/.env` and replace the `JWT_SECRET` placeholder with the generated value. Keep `.env` private; it is excluded from source control. The example MongoDB URI is `mongodb://127.0.0.1:27017/studentFeedbackDB`.

With MongoDB running, seed the local demo data and start the API:

```powershell
npm run seed
npm start
```

Keep this terminal open. The API listens on port `5000`. You can check it from another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Seeding creates or updates the demo users, courses, and feedback records in the configured database. Use it only with a development database, not with production data.

## 2. Start the frontend

In VS Code, open `frontend/index.html`, right-click in the editor, and choose **Open with Live Server**. Leave Live Server and the backend running. The frontend calls `http://127.0.0.1:5000/api`.

The demo accounts use the password `demo123`:

| Role | Email |
| --- | --- |
| Student | `aarav.kumar@sru.edu.in` |
| Faculty | `priya.menon@sru.edu.in` |
| Admin | `riya.sharma@sru.edu.in` |

These are development-only credentials. Do not use real student information or reuse these credentials outside the local prototype.

## Project layout

- `frontend/` contains the browser pages, styles, JavaScript, and assets.
- `backend/` contains the API, Mongoose models, seed script, and API-specific documentation.
- `backend/.env.example` lists the backend environment variables; create the untracked `backend/.env` for local use.

For the full project architecture, database relationships, security notes, and endpoint catalog, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md). Use [DEMO_GUIDE.md](./DEMO_GUIDE.md) for the role-by-role presentation sequence and screenshot checklist. For request examples and backend-specific setup, see [backend/README.md](./backend/README.md).

## Render and MongoDB Atlas deployment

The project is prepared for a Render Static Site (`frontend/`) and Render Node Web Service (`backend/`) using MongoDB Atlas. The static site's build command is `node build-config.js` and its publish directory is `.`; the backend uses `npm ci` and `npm start`. Set the frontend's `API_BASE_URL` to the backend's public HTTPS URL ending in `/api`. Set the backend's `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, and `FRONTEND_URL` in the Render dashboard only. Render supplies `PORT`.

The production frontend build writes its API base URL into generated `frontend/config.js`; the checked-in config continues to use localhost for local development. Do not run `npm run seed` against Atlas. Read [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for Atlas access controls, initial admin provisioning, complete Render settings, and hosted smoke tests.

## Troubleshooting

- If MongoDB connection fails, start the local MongoDB service and confirm the URI in `backend/.env`.
- If the frontend says it cannot reach the API, leave `npm start` running and check that port `5000` is available.
- If backend startup reports an invalid `JWT_SECRET`, replace the placeholder with a random value at least 32 characters long.

## Deployment security note

Preparing the configuration does not deploy the application. Hosting, Atlas credentials, and Render service URLs must still be configured by the project owner. Use HTTPS and managed secrets, restrict CORS to the deployed frontend origin, and review the remaining limitations in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) before inviting real users.
