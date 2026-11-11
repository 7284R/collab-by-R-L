# Collaboration by R/L

A dark, responsive community website built with React and Vite. Its demo feed includes posts, photo uploads, likes, comments, and sign-up and sign-in screens.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.
4. Create a production build with `npm run build`.

## Demo account and data

Accounts and feed posts are stored in the browser's local storage. This is a front-end demo, not production authentication or a shared online database. Data saved in one browser is not available to other users. Do not enter real passwords or sensitive information.

The `.env.example` file lists the variable names for the provided Supabase project. The current demo does not connect to Supabase yet. Add local Supabase credentials to `.env` only when implementing a Supabase integration; `.env` is intentionally excluded from Git.

## Publish on GitHub Pages

Push this project to a GitHub repository and select **Settings → Pages → GitHub Actions**. The included workflow builds the app and deploys it to GitHub Pages whenever changes are pushed to `main`.
