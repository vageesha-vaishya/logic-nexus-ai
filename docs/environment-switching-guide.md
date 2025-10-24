# Environment Switching Guide

This guide explains how to switch between Lovable Cloud (production) and your local Docker Supabase database for development.

## Overview

- **Lovable Cloud**: Production database (credentials in `.env`, auto-managed)
- **Local Development**: Docker Supabase (credentials in `.env.local`, manual)

## Setup Instructions

### 1. Configure .gitignore

**IMPORTANT**: Add the following to your `.gitignore` file:

```
.env.local
.env.local.backup
```

This ensures your local development credentials are never committed.

### 2. Add NPM Scripts (Optional)

Add these scripts to your `package.json` for easier environment switching:

```json
{
  "scripts": {
    "dev:local": "supabase start && vite",
    "dev:cloud": "vite"
  }
}
```

## Switching to Local Development

### Step 1: Start Local Supabase

```bash
npx supabase start
```

This command will output your local credentials:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
```

### Step 2: Create .env.local

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your local credentials from Step 1:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci... # Use anon key from supabase start
VITE_SUPABASE_PROJECT_ID=your_local_project_id
```

### Step 3: Start Development Server

```bash
npm run dev
```

Your app now connects to your local database. Check the environment indicator badge in the UI.

## Switching Back to Cloud

### Option 1: Delete .env.local

```bash
rm .env.local
```

### Option 2: Rename .env.local (to keep for later)

```bash
mv .env.local .env.local.backup
```

Then restart your dev server:

```bash
npm run dev
```

Your app now connects to Lovable Cloud. The environment indicator will show "Cloud".

## Migration Management

### Applying Migrations to Local Database

When you create migrations in Lovable, apply them to your local database:

```bash
npx supabase db reset
```

This command:
1. Resets your local database
2. Applies all migrations from `supabase/migrations/`
3. Runs seed data if configured

### Keeping Migrations in Sync

- Migrations created in Lovable are auto-applied to Cloud
- Pull latest migrations before developing locally
- Test migrations locally before pushing to Cloud

## Environment Indicator

The app includes a visual indicator showing which environment you're connected to:

- **Local Dev** (with HardDrive icon): Using local Docker database
- **Cloud** (with Cloud icon): Using Lovable Cloud database

This appears in the sidebar/header to prevent confusion.

## Troubleshooting

### "Connection refused" errors

- Ensure local Supabase is running: `npx supabase status`
- Check `.env.local` has correct URL: `http://127.0.0.1:54321`

### Changes not appearing

- Clear browser cache and local storage
- Restart dev server
- Verify you're connected to the right environment (check indicator)

### Migration conflicts

- Local: `npx supabase db reset` to reset and reapply all migrations
- Cloud: Migrations are managed automatically by Lovable

## Best Practices

1. **Always check the environment indicator** before making changes
2. **Use local for testing** migrations and schema changes
3. **Use Cloud for production** testing and final verification
4. **Keep .env.local out of git** (add to .gitignore)
5. **Document environment-specific configurations** in this file
6. **Test migrations locally** before they're auto-applied to Cloud

## Quick Reference

| Action | Command |
|--------|---------|
| Start local Supabase | `npx supabase start` |
| Stop local Supabase | `npx supabase stop` |
| Check local status | `npx supabase status` |
| Reset local DB | `npx supabase db reset` |
| Switch to local | Create/rename `.env.local` |
| Switch to cloud | Delete/rename `.env.local` |
| View migrations | Check `supabase/migrations/` |

## Notes

- `.env` is auto-managed by Lovable (Cloud credentials)
- `.env.local` takes precedence in Vite when it exists
- Never commit `.env.local` to version control
- Local project ID may differ from Cloud project ID
