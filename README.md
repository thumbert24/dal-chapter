# Chapter Command — Plain JS Version
## Supabase + Vanilla JavaScript + Vercel

No framework. No build step. No npm. Three files that work.

---

## File Structure

```
chapter-command/
├── index.html       ← The entire app shell and all panels
├── vercel.json      ← Tells Vercel this is a static site
├── css/
│   └── style.css    ← Black and old gold design system
└── js/
    └── app.js       ← All data fetching, auth, and UI logic
```

---

## Setup (5 minutes)

### 1. Add Your Supabase Credentials

Open `js/app.js` and replace lines 10–11:

```javascript
const SUPABASE_URL  = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON = 'your-anon-key-here';
```

Find these values in:
**Supabase Dashboard → Settings (gear icon) → API**
- **Project URL** → `SUPABASE_URL`
- **anon / public** key → `SUPABASE_ANON`

> ⚠️ Use the **anon key** here, NOT the service_role key.
> The anon key is safe to use in browser code — Supabase RLS policies
> control what each user can see and do.

### 2. Run the Database Schema

If you haven't already, run `schema.sql` in Supabase → SQL Editor.
This creates all 13 tables, 5 views, and the RLS policies.

### 3. Test Locally

Just open `index.html` in a browser — no server needed.

> Note: Magic link sign-in won't work locally (it redirects to your
> production URL). Use password sign-in for local testing.

### 4. Deploy to Vercel

**Option A — Drag and drop (easiest):**
1. Go to vercel.com → Add New Project
2. Drag your entire `chapter-command` folder onto the upload area
3. Click Deploy

**Option B — GitHub (auto-deploys on push):**
```bash
git init
git add .
git commit -m "Initial chapter command"
git remote add origin https://github.com/YOUR_USERNAME/chapter-command.git
git push -u origin main
```
Then: Vercel → Add New Project → Import from GitHub

No environment variables needed — your Supabase credentials live
directly in `app.js`.

### 5. Add Your Domain to Supabase

After deploying, go to:
**Supabase → Authentication → URL Configuration → Redirect URLs**

Add:
```
https://your-app.vercel.app
```

This allows magic link sign-ins to work in production.

---

## Creating Your First Admin User

In Supabase → Authentication → Users → Invite User → enter your email.

Then set your role in Supabase → SQL Editor:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"chapter_role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';
```

---

## Making Updates

Edit any file, then either:
- Re-drag the folder to Vercel (replaces the deployment)
- Or push to GitHub if you set that up (auto-deploys)

No build commands. No `npm install`. Just save and deploy.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page | Check browser console (F12) for errors |
| "Invalid API key" | Verify SUPABASE_URL and SUPABASE_ANON in app.js |
| Can't sign in | Confirm user exists in Supabase → Authentication → Users |
| Data not loading | Run schema.sql in Supabase SQL Editor |
| Magic link fails | Add your Vercel URL to Supabase → Auth → Redirect URLs |
