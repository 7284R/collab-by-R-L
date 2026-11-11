# Collaboration by R/L

A dark, responsive community website built with React, Vite, and Supabase Auth. Its feed includes posts, photo uploads, likes, comments, and Supabase-powered sign-up and sign-in.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.
4. Create a production build with `npm run build`.

## Supabase configuration

Create a `.env` file from `.env.example` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for local development. Restart Vite after changing environment variables.

For GitHub Actions deployment, add the same two values as repository Actions secrets with those exact names. The workflow passes them to Vite at build time and fails clearly if either secret is missing. Never commit `.env` or a Supabase secret key. The publishable key is intended for browser use; protect database tables with Supabase Row Level Security.

Enable email/password authentication and **Confirm email** in Supabase Authentication settings. Add `https://7284R.github.io/collab-by-R-L/` to the Supabase project's allowed redirect URLs. The app rejects unverified sessions and requires users to confirm their email address before signing in. Accounts are managed by Supabase Auth. Feed posts are still stored in the current browser and are not shared with other users.

The demo profile cards and seeded sample posts have been removed. On first load, previously saved sample posts are deleted; only posts associated with a signed-in account are retained. Email verification confirms access to an inbox but does not, by itself, prove that an account belongs to a particular person or prevent all automated sign-ups.

## Publish on GitHub Pages

Select **Settings → Pages → GitHub Actions** in the GitHub repository. The included workflow builds the app and deploys it to GitHub Pages whenever changes are pushed to `main`.
