## Smart Exam Practice

Next.js App Router foundation for account registration, sign-in, profile management, and a responsive learning dashboard.

### Setup

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `MONGODB_URI` to a rotated MongoDB credential with access to the cluster. The direct-seed format in `.env.example` avoids SRV DNS lookups on networks where Node cannot resolve them. Keep `MONGODB_DB=SmartExamPractice` and `MONGODB_COLLECTION=users`.
4. Set `SESSION_SECRET` to a private random value of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
5. Run `npm install`, then `npm run dev` and open `http://localhost:3000`.

The MongoDB account needs read/write access to the `users` collection and permission to create its unique username/email indexes. Environment files are ignored by Git.

### Routes

- `/register` creates a user and immediately starts a session.
- `/login` accepts a username or email.
- `/dashboard` and `/profile` require an active session.
- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, and `/api/profile` provide the server-side API.

The session is an HMAC-signed, HTTP-only cookie. Passwords are stored as bcrypt hashes. Learning modules remain empty placeholders until their data and workflows are implemented.

### Checks

Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` before deployment.
