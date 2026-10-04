# Timetable

Classes, daily routines and attendance in one place.

Built with Next.js (React), Turso, and Google sign-in. Each person signs in with their Gmail and only sees their own classes, routines and attendance.

## Set up

1. Install dependencies

   ```bash
   npm install
   ```

2. Create a Turso database

   ```bash
   turso auth login
   turso db create timetable
   turso db show timetable --url
   turso db tokens create timetable
   ```

3. Set up Google sign-in

   - Go to https://console.cloud.google.com, create a project, then open APIs & Services, OAuth consent screen and set it up (External is fine).
   - Open Credentials, Create credentials, OAuth client ID, type Web application.
   - Under Authorized redirect URIs add `http://localhost:3000/api/auth/callback/google`. When you deploy, also add `https://YOUR-DOMAIN/api/auth/callback/google`.
   - Copy the client ID and client secret.
   - While the consent screen is in Testing mode, only Gmail addresses you list under Test users can sign in. Publish the app to let anyone in.

4. Copy `.env.example` to `.env.local` and fill it in

   ```
   TURSO_DATABASE_URL=libsql://timetable-yourname.turso.io
   TURSO_AUTH_TOKEN=...
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

   Leave the two Turso values empty to try the app first with a local file database (`local.db`).
   On Vercel, add the same variables in the project settings.

5. Run it

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The tables are created automatically on the first request.

## Load your class schedule

Run this with the Gmail address you sign in with:

```bash
npm run seed -- you@gmail.com sociology
```

The last word is the elective: `sociology`, `language` or `demography`.

This adds the shared classes (lectures, tutorials and labs), a daily lunch routine, and the elective you name. Running it twice does not create duplicates. The data lives at the top of `scripts/seed.mjs` if you ever need to change it. 

## Electives

Students pick their HSS elective the first time they sign in, and the shared timetable plus that elective is loaded for them automatically. They can switch later by clicking their photo, then Change next to HSS elective (switching removes the old elective's attendance). 

| Elective | Code | Days, 2 to 3 pm | Room |
| --- | --- | --- | --- |
| Sociology | HS2111 | Tue, Wed, Thu | LT001 |
| Language | HS2110 | Wed, Thu, Fri | LT103 |
| Demography | HS2112 | Tue, Wed, Thu | LT103 on Tue, LT003 on Wed and Thu |

To add or edit electives, shared classes, rooms or times, change `lib/curriculum.js`.

## Data from before logins

If you already had classes saved, set `OWNER_EMAIL=you@gmail.com` in `.env.local` (or your host's settings) and restart. The old data becomes yours.

## Using it

- The class schedule is fixed: students cannot add, edit or delete classes. Only an admin can change it, by editing `lib/curriculum.js`. Students can still add, edit and delete their own routines (gym, study and so on) with the Add button, picking several days at once to repeat weekly.
- On the Day view, tap the tick or cross on a class to record attendance. Tap it again to undo.

## Notes

- The minimum attendance (75%) is the `MIN_ATTENDANCE` constant at the top of `components/TimetableApp.js`.
- Every API call checks the signed-in Gmail, and each row in the database is stored against that email, so one person cannot read or change another person's data.
- Click your photo (top right on phones, bottom of the sidebar on laptops) to see your account or sign out.

## Install as an app (PWA)

The app ships with a web app manifest (`app/manifest.js`), icons (`public/icons`), a small service worker (`public/sw.js`) and an offline screen (`public/offline.html`).

- The service worker only registers in production, so run `npm run build && npm start` (or deploy) to test installing. It never caches `/api`, so your schedule always comes from the server.
- Android and desktop Chrome or Edge: open the app, then Account, then Install. Or use the browser's install icon.
- iPhone: open in Safari, tap Share, then Add to Home Screen.
- Installing needs HTTPS. `localhost` also works for testing.
