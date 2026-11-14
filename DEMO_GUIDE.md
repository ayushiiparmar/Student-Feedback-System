# Project Demonstration Guide

This guide uses only the existing seeded demo accounts for the Student, Faculty, and Admin logins. Use a local development database, never production or real student information.

## Before the presentation

1. Follow the startup instructions in [README.md](./README.md).
2. Verify MongoDB, start the backend, and open the frontend through VS Code Live Server.
3. Keep the backend terminal available to show the MongoDB connection and API startup messages.
4. The seed contains 10 students, 5 faculty members, 1 admin, 5 courses, and 10 feedback records.
5. Do not display `.env`, JWT values, browser storage, or Authorization headers during screenshots.

### Seeded logins

All three accounts use password `demo123`.

| Role | Email |
| --- | --- |
| Student | `aarav.kumar@sru.edu.in` |
| Faculty | `priya.menon@sru.edu.in` |
| Admin | `riya.sharma@sru.edu.in` |

## Suggested demonstration sequence

### A. Student flow

1. On the login page, choose the Student role and sign in with `aarav.kumar@sru.edu.in` / `demo123`.
2. Point out the student's profile, enrolled courses, assigned faculty, and per-course feedback status.
3. The seeded student has submitted feedback for **CSE301**. Open its status/history to show that submitted feedback is read-only.
4. Open an unsubmitted course such as **MAT221** or **MBA211**.
5. Rate all five categories using only integer values 1–5: Clarity, Communication, Punctuality, Engagement, and Subject Knowledge. Leave comments empty to demonstrate that comments are optional, or enter a short non-identifying comment.
6. Submit once, show the confirmation and updated course status, and return to the course to show it cannot be submitted again.
7. Open the student's feedback history and show only the authenticated student's own submissions.
8. Log out before switching roles.

Submitting feedback changes the local development database. The seed script updates matching seeded feedback records when run again, but does not delete unrelated records.

### B. Faculty flow

1. Sign in as `priya.menon@sru.edu.in` / `demo123` using the Faculty role.
2. Show that only courses assigned to Dr. Priya Menon are listed (the seeded assignment is **CSE301**).
3. Open course analytics and point out course average, five parameter ratings, and the Chart.js visualization.
4. Show the privacy-filtered comments/trends state. The seeded CSE301 course has fewer than five feedback submissions, so comments are correctly withheld by the minimum-five threshold.
5. Emphasize that the faculty view does not show student names, emails, or student IDs.
6. Log out before switching roles.

The seed dataset does not meet the comment-release threshold for the assigned course. Do not imply that individual comments should be visible with this seed data; demonstrating the withheld state is a valid privacy demonstration.

### C. Admin flow

1. Sign in as `riya.sharma@sru.edu.in` / `demo123` using the Admin role.
2. Show the dashboard totals (seeded baseline: 10 students, 5 faculty, 5 courses, 10 feedback submissions), overall average, and top-faculty panel.
3. Open **Manage Students** and **Manage Faculty** to show the live account lists and management actions.
4. Open **Manage Courses** to show course records and available create/edit/delete controls.
5. Open faculty/course assignments and student/course enrollments to show the seeded mappings and administrative controls.
6. Open **Reports & Analytics**. Explain the overall and parameter averages, course and department performance, top-five faculty ranking, and rating distribution charts.
7. Use **Export report** to download the browser-generated CSV if report export is part of the presentation.
8. Log out.

For a non-destructive presentation, inspect existing records without deleting or changing seeded accounts, courses, or mappings. If you demonstrate a mutation, use a clearly named temporary record in a disposable local database and clean it up after the presentation.

## Screenshot checklist for the project report

Capture screenshots with demo data only. Keep the browser window wide enough to show the full dashboard; optionally capture one mobile-width screenshot to demonstrate responsiveness.

1. Login page with SR University branding and role selection.
2. Student dashboard showing profile, enrolled courses, faculty assignments, and feedback statuses.
3. Student feedback form showing all five 1–5 rating controls and optional comments field.
4. Feedback submission confirmation.
5. Submitted course feedback/status shown as read-only.
6. Student feedback history.
7. Faculty dashboard showing only the assigned course and course summary.
8. Faculty category-wise chart/analytics.
9. Faculty privacy-threshold state showing comments withheld; ensure no identity data appears.
10. Admin dashboard showing seeded totals and top-five faculty summary.
11. Manage Students and Manage Faculty pages.
12. Manage Courses and faculty/student assignment pages.
13. Reports page with department/course/parameter charts and rating distribution.
14. Optional: downloaded CSV opened in a spreadsheet application.
15. Optional: mobile-width view of a dashboard/navigation menu.

Suggested filenames: `01-login.png`, `02-student-dashboard.png`, `03-feedback-form.png`, `04-feedback-confirmation.png`, `05-student-history.png`, `06-faculty-dashboard.png`, `07-faculty-analytics-privacy.png`, `08-admin-dashboard.png`, `09-admin-management.png`, `10-admin-assignments.png`, and `11-admin-reports.png`.

## Submission and clean ZIP checklist

- [ ] MongoDB starts and responds to a ping.
- [ ] Backend starts and `/api/health` responds with `status: ok`.
- [ ] Live Server opens the login page and the frontend can reach the backend.
- [ ] Student, Faculty, and Admin logins work with the seeded accounts.
- [ ] Capture the report screenshots listed above.
- [ ] Include `backend/package-lock.json` and `backend/.env.example`.
- [ ] Exclude `.env`, every other secret/config override, `node_modules`, `.git`, logs, and temporary files.
- [ ] Confirm the ZIP contains `frontend/`, `backend/`, and the Markdown documentation.
- [ ] Do not include real student data or credentials in the submission archive.

### PowerShell source ZIP instructions

Run this from PowerShell after checking the project root. It stages a clean copy, excludes dependency folders, Git metadata, environment files, and logs, then adds back the safe `.env.example` template:

```powershell
$source = "D:\Desktop\hacathon sem3\Student-Feedback-System"
$stage = Join-Path $env:TEMP ("Student-Feedback-System-" + [guid]::NewGuid().ToString("N"))
$stagedProject = Join-Path $stage "Student-Feedback-System"
$zip = Join-Path $env:USERPROFILE "Desktop\Student-Feedback-System-source.zip"

New-Item -ItemType Directory -Path $stagedProject -Force | Out-Null
robocopy $source $stagedProject /E /XD node_modules .git /XF .env .env.* *.log
if ($LASTEXITCODE -ge 8) { throw "Robocopy failed with exit code $LASTEXITCODE." }
Copy-Item (Join-Path $source "backend\.env.example") (Join-Path $stagedProject "backend\.env.example") -Force
Compress-Archive -Path $stagedProject -DestinationPath $zip -Force
Write-Output "Created $zip"
```

Inspect the ZIP before sending it. Confirm the archive includes the project folders and `.env.example`, but contains no `.env`, other secret file, `node_modules`, or log. After inspection, remove only the staging folder created by this command if desired:

```powershell
Remove-Item -LiteralPath $stage -Recurse -Force
```

## Local-development caveats for the presentation

- The backend must remain running on port `5000`; the frontend calls `http://127.0.0.1:5000/api`.
- The sample credentials are public demonstration credentials, not private or production accounts.
- Faculty comment anonymization uses a five-response threshold and heuristic text redaction; it does not guarantee anonymity against indirect clues.
- The frontend is hosted locally with Live Server and is not configured for a public domain.
- The admin export is a browser-generated CSV, not a backend report-generation service.

