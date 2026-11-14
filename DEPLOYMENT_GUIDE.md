# Render and MongoDB Atlas Deployment Guide

Deployment is **not complete**. This guide prepares the existing application for deployment and lists the owner actions that still require Render and MongoDB Atlas accounts. No production database is seeded automatically.

## 1. Project roots and deployment settings

| Service | Root directory | Build command | Start / publish setting |
| --- | --- | --- | --- |
| Render Static Site | `frontend` | `node build-config.js` | Publish directory: `.` |
| Render Node Web Service | `backend` | `npm ci` | Start command: `npm start`; health-check path: `/api/health` |

`frontend/config.js` is the local-development configuration. The static-site build script generates it on Render from `API_BASE_URL`, and the generated production configuration disables sample demo-account controls. `script.js` loads this config on all four pages. The frontend receives only the public API URL; `MONGODB_URI` and `JWT_SECRET` belong only in the backend service environment.

Choose unique Render service names before setting the origins. The Render URLs usually follow `https://<service-name>.onrender.com`; use the actual URLs shown in the dashboards. If a URL differs from the planned one, update the corresponding environment variable and redeploy.

## 2. Create and secure MongoDB Atlas

1. Create an Atlas account/project and a MongoDB cluster in a region reasonably close to the Render service.
2. In **Database Access**, create a dedicated database user for this application. Grant only `readWrite` access to `studentFeedbackDB`; do not reuse the Atlas account password.
3. Use Atlas **Connect → Drivers** to copy the `mongodb+srv://` URI. Set its database path to `studentFeedbackDB`. URL-encode special characters in the database username/password when required by the URI format.
4. In **Network Access**, allow the Render Web Service's outbound IP addresses shown in that service's Render dashboard. If Render lists multiple egress ranges, add all applicable ranges. Add your workstation IP temporarily only if you will provision the initial administrator from your computer, then remove it.
5. Do not use `0.0.0.0/0` for a production database. Do not place the Atlas URI in frontend code, browser storage, source control, or screenshots.

Atlas creates collections as the application writes its first records. The database name used by this project is `studentFeedbackDB`.

## 3. Create the Render backend service

1. In Render, create a **Web Service** from the project repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `npm ci`.
4. Set **Start Command** to `npm start`.
5. Set **Health Check Path** to `/api/health`.
6. Add these environment variables in Render's service settings:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas `mongodb+srv://.../studentFeedbackDB...` URI |
   | `JWT_SECRET` | A new random secret of at least 32 characters |
   | `JWT_EXPIRES_IN` | `1d` (or an institution-approved duration) |
   | `FRONTEND_URL` | Exact deployed frontend origin, such as `https://your-site.onrender.com` |

   `FRONTEND_URL` accepts a comma-separated list of exact origins if using both a Render URL and a custom domain. Do not append a path such as `/api`.

7. Leave `PORT` unset; Render supplies it. Do not set `MONGODB_TEST_URI` on the production service. Never add credentials to `render.yaml`, a committed `.env`, or frontend variables.
8. Deploy and wait for the service to become healthy. Verify `https://<backend-service>.onrender.com/api/health` returns `{"status":"ok"}`.

Generate a secret locally if desired, without saving it to the repository:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value directly into the backend's Render environment settings. Do not use the documented development sample password or a password from another account.

## 4. Create the Render Static Site

1. Create a **Static Site** from the same repository.
2. Set **Root Directory** to `frontend`.
3. Set **Build Command** to `node build-config.js`.
4. Set **Publish Directory** to `.`.
5. Set the static site's build environment variable:

   | Variable | Value |
   | --- | --- |
   | `API_BASE_URL` | `https://<backend-service>.onrender.com/api` |

   It must be an absolute HTTPS URL ending exactly in `/api`. The build script rejects missing values, non-HTTPS URLs, embedded credentials, query strings, and other paths.

6. Deploy the site and note its exact public origin. Ensure that origin matches the backend's `FRONTEND_URL` exactly. If you use a custom domain, add it to `FRONTEND_URL` as an additional comma-separated origin and redeploy the backend.
7. If the Render service URL differs from the URL configured in either service, update `API_BASE_URL` or `FRONTEND_URL` as applicable and redeploy that service.

`API_BASE_URL` is public routing configuration, not a secret. The generated `config.js` contains only that URL and a flag that disables demo-account controls. It never contains an Atlas URI or JWT secret.

## 5. Provision production data without seeding

Do **not** run `npm run seed` against Atlas. That script creates/resets demo records and is for development only. Public registration creates students only; an administrator must create faculty and courses through the admin module.

The backend includes a one-time `npm run bootstrap:admin` command. It creates an administrator only if the database has no admin and refuses to overwrite an existing account. It reads `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` from the process environment; the password is hashed by the existing User model.

To run it from your computer:

1. Install backend dependencies and configure a **local, ignored** `backend/.env` with the production `MONGODB_URI` from Atlas. Confirm this connection string points to the intended production database. Do not commit or share the file.
2. Temporarily allow your workstation's IP in Atlas Network Access.
3. In PowerShell, from `backend`, enter the admin details. The password prompt below does not echo the password:

```powershell
Set-Location "D:\Desktop\hacathon sem3\Student-Feedback-System\backend"
$env:INITIAL_ADMIN_NAME = Read-Host "Initial administrator name"
$env:INITIAL_ADMIN_EMAIL = Read-Host "Initial administrator email"
$securePassword = Read-Host "Initial administrator password (at least 8 characters)" -AsSecureString
$credential = New-Object System.Net.NetworkCredential("", $securePassword)
$env:INITIAL_ADMIN_PASSWORD = $credential.Password
try {
  npm run bootstrap:admin
} finally {
  Remove-Item Env:\INITIAL_ADMIN_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:\INITIAL_ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:\INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
```

4. Confirm the script reports successful creation, then remove the workstation IP from the Atlas allowlist. If the command reports that an admin already exists, stop; it will not update or replace that account.
5. Sign in with the new administrator using the deployed site. Create faculty accounts and courses, assign faculty, and enroll students. Students can also register from the public registration form. Use unique strong passwords and do not use demo credentials for real people.

## 6. Production CORS and health checks

- Production CORS permits only the origin(s) in backend `FRONTEND_URL`. Local `localhost` and `127.0.0.1` origins are accepted only when `NODE_ENV` is not `production`.
- A missing `FRONTEND_URL` prevents production backend startup. If the browser reports a CORS error, compare the frontend URL in its address bar with the exact configured origin (scheme and hostname; no path or trailing slash needed).
- The health endpoint is public and intended for Render's health check. Backend startup validates `JWT_SECRET`, connects to MongoDB, and only then starts listening on Render's `PORT`.
- API server errors return a generic message to clients; detailed database connection failures are logged with URI credentials redacted.

## 7. Hosted smoke-test checklist

After both services deploy and the initial admin is provisioned, use the actual production site and non-demo accounts:

1. Confirm the static login page loads over HTTPS and no browser console errors report a missing `config.js` or failed API URL.
2. Register a new student and sign in. Confirm the student profile and empty/enrolled-course states load.
3. As the administrator, create a faculty account and a course, assign the faculty member, enroll the student, and confirm the student/course lists update.
4. As the student, submit a five-rating feedback form with optional comments. Confirm status/history updates and the course cannot be submitted twice.
5. As the assigned faculty member, confirm only assigned courses appear, summaries load, and responses contain no student identities.
6. As the administrator, confirm course/department analytics and charts load and CSV export downloads.
7. Check the browser network panel for successful requests to the deployed backend and verify each response has the expected CORS origin. Do not capture or share Authorization headers.

The automated checks available before hosting are `npm test` and Node syntax checks. A successful local test run cannot verify Atlas credentials, Render service configuration, DNS, production CORS, or hosted workflows. Complete the checklist above after deployment; do not describe the project as deployed until those checks pass.

## Remaining production limitations

- The local demo logins and role-switch UI are disabled in the generated Render frontend; the demo credentials remain only for local development.
- Comment anonymization is heuristic even with the five-response threshold and cannot guarantee anonymity against indirect clues.
- There is no password-reset, email-verification, account-recovery, or administrative audit-log workflow.
- Review CORS, database backups, rate limiting, monitoring, data retention, and institutional privacy/security requirements before use with real student data.
- This guide does not create Render services, Atlas resources, credentials, or production records on your behalf.
