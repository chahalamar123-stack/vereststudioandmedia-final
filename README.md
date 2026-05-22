# Everest Studio & Media

Premium Everest Studio & Media website with a contact form, inquiry database, and protected admin dashboard.

## Start locally

```bash
npm install
npm start
```

The site runs on one Express server and serves both the public website and the admin/API routes.

## Required environment variables

Create a `.env` file locally or configure these in your hosting platform:

```env
ADMIN_EMAIL=contact@evereststudioandmedia.com
ADMIN_PASSWORD=EverestAdmin2026!
ADMIN_SESSION_SECRET=replace_with_long_random_secret
DATABASE_URL=your_database_url_here
```

Optional variables:

```env
PORT=3000
DATABASE_SSL=true
COOKIE_SECURE=true
```

## Database

The app is designed for a Vercel-friendly Postgres database using `DATABASE_URL`, such as:

- Supabase Postgres
- Neon Postgres
- Vercel Postgres

If `DATABASE_URL` is not set locally, the app falls back to the existing `inquiries.db` SQLite file so you can still develop and test the flow on your machine.

Inquiry fields:

- `id`
- `name`
- `phone`
- `email`
- `message`
- `status`
- `createdAt`
- `updatedAt`

Supported inquiry statuses:

- `New`
- `Contacted`
- `Closed`

## Admin routes

- `/admin`
  - Admin login page
- `/admin/dashboard`
  - Protected inquiry dashboard

## API routes

- `POST /api/inquiry`
  - Saves a new inquiry
- `POST /api/admin/login`
  - Creates a secure HTTP-only admin session cookie
- `GET /api/admin/session`
  - Returns current authentication state
- `GET /api/admin/inquiries`
  - Returns all inquiries, newest first
- `PATCH /api/admin/inquiries/:id`
  - Updates inquiry status
- `DELETE /api/admin/inquiries/:id`
  - Deletes an inquiry
- `POST /api/admin/logout`
  - Clears the admin session cookie

All API routes return JSON only.

## Vercel setup

1. Create a Postgres database in Neon, Supabase, or Vercel Postgres.
2. Copy the connection string into `DATABASE_URL`.
3. In Vercel, open your project.
4. Go to `Settings` -> `Environment Variables`.
5. Add:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   - `DATABASE_URL`
   - `DATABASE_SSL=true` if your Postgres provider requires SSL
6. Redeploy the project.

## Changing the admin password later

Update `ADMIN_PASSWORD` in your environment variables, save, and restart or redeploy the app.

## Security notes

- Admin auth is stored in an HTTP-only cookie.
- The admin password is never exposed in client-side code.
- Database secrets stay server-side in environment variables.
- Basic rate limiting is enabled for inquiry submissions and admin login attempts.
