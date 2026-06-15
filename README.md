# Attendify — Smart Attendance Management Platform

A full-stack web app that lets faculty take attendance with a **time-bound QR code**, gives students a one-tap "mark me present" flow, and surfaces **real-time attendance analytics** for everyone.

Built with **React + TypeScript + TailwindCSS** on the frontend and **Node.js + Express + TypeScript + MongoDB** on the backend, secured with **JWT**.

---

## Features

### Faculty
- Sign in, create subjects, enroll students by email or roll number.
- Start an attendance session — generates a **short-lived random code** rendered as a **QR**.
- Live dashboard showing students marking themselves present in real time, with countdown timer.
- Per-subject analytics: average %, per-student bar chart, "at-risk" sorting.
- One-click **CSV export** of subject attendance.

### Student
- Sign in, see **subject-wise attendance %** with progress bars and pie chart.
- Mark attendance by **scanning the QR with the camera** (html5-qrcode) or pasting the code.
- Detailed per-subject session history (present / absent for each class).

---

## Tech Stack

| Layer       | Tech                                                                    |
|-------------|-------------------------------------------------------------------------|
| Frontend    | React 18, TypeScript, Vite, TailwindCSS, React Router, Recharts, Axios  |
| Backend     | Node.js, Express, TypeScript                                            |
| Database    | MongoDB + Mongoose                                                      |
| Auth        | JWT (jsonwebtoken) + bcryptjs                                           |
| QR          | `qrcode` (server-side data URL) + `html5-qrcode` (browser scanner)      |
| Validation  | Zod                                                                     |

---

## Project Structure

```
Attendify/
├── server/                       Express + TypeScript API
│   └── src/
│       ├── config/               env + db connection
│       ├── models/               Mongoose schemas (User, Subject, Session, Attendance)
│       ├── controllers/          Business logic per resource
│       ├── routes/               Route registration + middleware wiring
│       ├── middleware/           auth, validate, errorHandler
│       ├── utils/                jwt, asyncHandler, AppError, seed
│       ├── app.ts                Express app factory
│       └── index.ts              Server bootstrap
└── client/                       React + Vite + TypeScript SPA
    └── src/
        ├── lib/                  api client, shared types
        ├── context/              AuthContext (token + user)
        ├── components/           Layout, ProtectedRoute, primitives
        └── pages/
            ├── Login.tsx, Register.tsx
            ├── faculty/          dashboard, subjects, subject detail (QR + analytics)
            └── student/          dashboard, mark attendance (QR scan), subject history
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (or a connection string to MongoDB Atlas)

### 1. Backend

```bash
cd server
cp .env.example .env          # then edit JWT_SECRET / MONGO_URI as needed
npm install
npm run seed                  # optional: creates a demo faculty + 3 students + 1 subject
npm run dev                   # starts on http://localhost:5000
```

Demo credentials after `npm run seed`:

| Role     | Email                       | Password      |
|----------|-----------------------------|---------------|
| Faculty  | `faculty@attendify.dev`     | `password123` |
| Student  | `rahul@attendify.dev`       | `password123` |
| Student  | `priya@attendify.dev`       | `password123` |
| Student  | `aman@attendify.dev`        | `password123` |

### 2. Frontend

```bash
cd client
npm install
npm run dev                   # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so no extra config is needed.

---

## API Reference (quick)

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path                | Body                                                    |
|--------|---------------------|---------------------------------------------------------|
| POST   | `/auth/register`    | `{ name, email, password, role, rollNumber?, department? }` |
| POST   | `/auth/login`       | `{ email, password }`                                  |
| GET    | `/auth/me`          | —                                                       |

### Subjects (auth required)
| Method | Path                              | Who      | Purpose                       |
|--------|-----------------------------------|----------|-------------------------------|
| GET    | `/subjects`                       | both     | List my subjects              |
| GET    | `/subjects/:id`                   | both     | Subject details               |
| POST   | `/subjects`                       | faculty  | Create a subject              |
| POST   | `/subjects/:id/students`          | faculty  | Enroll by emails / rolls      |
| DELETE | `/subjects/:id/students/:studentId` | faculty | Remove a student              |

### Sessions
| Method | Path                                | Who     | Purpose                                       |
|--------|-------------------------------------|---------|-----------------------------------------------|
| POST   | `/sessions`                         | faculty | Start a session — returns `{ session, qrDataUrl }` |
| POST   | `/sessions/:id/close`               | faculty | Close session early                           |
| GET    | `/sessions/subject/:subjectId`      | faculty | Recent sessions with present counts           |
| GET    | `/sessions/:id/attendance`          | both    | Who marked in this session                    |
| POST   | `/sessions/mark`                    | student | Body: `{ code }`. Idempotent                  |

### Analytics
| Method | Path                                          | Who     | Purpose                          |
|--------|-----------------------------------------------|---------|----------------------------------|
| GET    | `/analytics/subjects/:subjectId`              | faculty | Per-student summary              |
| GET    | `/analytics/subjects/:subjectId/export`       | faculty | CSV download                     |
| GET    | `/analytics/me/overview`                      | student | All-subjects summary             |
| GET    | `/analytics/me/subjects/:subjectId`           | student | Per-subject history              |

---

## Architecture Highlights (interview talking points)

- **Layered backend** — `routes → controllers → models`, with thin route files, focused controllers, and shared concerns (`AppError`, `asyncHandler`, `validateBody`) extracted into reusable utilities.
- **Zod-validated request bodies** mean controllers receive already-typed input; no manual `if (!body.x) throw …` noise.
- **JWT auth + role-based middleware** — `authenticate` parses the bearer token and attaches `req.user`; `authorize('faculty')` gates routes by role.
- **Mongoose pre-save hook** hashes passwords with bcrypt only when modified, so re-saving a user doesn't double-hash.
- **Compound unique indexes** enforce business rules at the DB level:
  - `(faculty, code)` on `Subject` — no duplicate subject codes per faculty.
  - `(session, student)` on `Attendance` — a student can only be marked once per session.
- **Short-lived random codes** (`crypto.randomBytes(16)`) for QR sessions, with `expiresAt` enforced server-side — so even a leaked code stops working after the class.
- **Idempotent attendance marking** — a student submitting the same code twice gets a success response instead of a duplicate-key error.
- **Reuse-on-double-start** — if a faculty accidentally clicks "Start session" twice, the API returns the existing active session instead of creating a confusing duplicate.
- **Aggregation pipelines** for `presentCount` per session and per student so the dashboard stays fast as data grows.
- **Real-time-ish UI** — the live session card polls attendance every 4s while open, so students appear without a manual refresh.
- **Typed frontend ↔ backend contract** — shared shapes in `client/src/lib/types.ts` mirror the API responses.
- **Auth context with auto-rehydration** — on app load, the stored JWT is exchanged for the current user via `/auth/me`; a 401 anywhere automatically clears the bad token.
- **Defensive QR flow on the client** — students can fall back to typing the code if camera access is denied.

---

## Deployment

Recommended stack (all free tiers, ~15 minutes end to end):

| Piece | Platform | Why |
|---|---|---|
| Frontend (Vite SPA) | **Vercel** | Zero-config Vite, global CDN, instant HTTPS |
| Backend (Express) | **Render** | Real free web-service tier, GitHub auto-deploy, HTTPS |
| Database | **MongoDB Atlas** | Free M0 cluster |

> ⚠ The student QR scanner needs camera access, which browsers only allow over HTTPS. All three platforms above provide HTTPS automatically — don't deploy to a plain VPS without an SSL cert.

### Step 1 — MongoDB Atlas

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. Database Access → add a user with a password.
3. Network Access → add `0.0.0.0/0` (allow from anywhere — Render's IPs are dynamic).
4. Copy the connection string. **URL-encode any special characters in the password** (e.g. `@` becomes `%40`).

### Step 2 — Backend on Render

1. Push the project to GitHub.
2. Render dashboard → **New + → Blueprint** → connect your repo.
3. Render reads `server/render.yaml` automatically and provisions an `attendify-api` web service.
4. In the service settings, fill in the three secrets it asks for:
   - `MONGO_URI` — your Atlas connection string (with `/attendify` as the DB name)
   - `JWT_SECRET` — a long random string. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `CLIENT_ORIGIN` — leave blank for now; you'll set it after the Vercel deploy
5. Click **Deploy**. After ~3 minutes you'll have something like `https://attendify-api.onrender.com`. Visit `/api/health` to confirm it's up.

### Step 3 — Frontend on Vercel

1. Vercel dashboard → **Add New → Project** → import your GitHub repo.
2. **Root directory:** `client`. (The `vercel.json` handles the rest, including SPA routing.)
3. Environment variables → add one:
   - `VITE_API_URL` = `https://YOUR-RENDER-URL.onrender.com/api` (note the trailing `/api`)
4. Click **Deploy**. You'll get something like `https://attendify.vercel.app`.

### Step 4 — Tell the backend about the frontend

Go back to Render → `attendify-api` → **Environment** → set `CLIENT_ORIGIN` to your Vercel URL, e.g.

```
CLIENT_ORIGIN=https://attendify.vercel.app
```

Render redeploys automatically. CORS will now accept requests from your Vercel app.

### Step 5 — Seed demo data (optional, one-time)

The easiest way is to run the seed script locally against the same Atlas DB:

```bash
cd server
# Make sure .env points to the same MONGO_URI you used on Render
npm run seed
```

### Deployment gotchas to know about

- **Render free tier sleeps after 15 minutes** of no requests. The first call after a nap takes ~30s to wake the dyno. For an interview demo, hit your `/api/health` URL once before you start to warm it up.
- **VITE_API_URL is baked in at build time.** If you change it in Vercel, you must trigger a new deploy.
- **Don't ever commit `.env`** — both `client/.gitignore` and `server/.gitignore` exclude it. Secrets live in Render and Vercel dashboards.
- **CORS errors in the browser usually mean** `CLIENT_ORIGIN` on Render doesn't exactly match the URL the browser is loading (watch for `http` vs `https`, trailing slashes).

---

## Suggested Demo Script (for the interview)

1. `npm run seed`, then `npm run dev` (server) and `npm run dev` (client).
2. Open **two windows side by side**: faculty in one, student in the other.
3. Faculty: open the `CS301` subject → click **Start attendance session** → a QR + countdown appears.
4. Student: go to **Mark attendance**, paste the code (or scan if on a phone with HTTPS).
5. Watch the faculty page update the "Marked present" counter live.
6. Switch to the **Analytics** tab to show the bar chart and CSV export.
7. From the student dashboard, show the pie chart, per-subject % and session history.

---

## Future Improvements

- WebSocket / SSE push instead of polling for live attendance updates.
- Geofencing — only allow students within X meters of the classroom to mark.
- Faculty-level analytics across all subjects (semester reports).
- Email/SMS alerts for students dropping below 75%.
- Mobile app via React Native with the same API.

---

## License

MIT — built for educational/portfolio use.
