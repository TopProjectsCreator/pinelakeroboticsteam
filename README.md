
# Pinelake Robotics Team Website
![CI](https://github.com/TopProjectsCreator/pinelakeroboticsteam/actions/workflows/ci.yml/badge.svg)

[Visit the live site](https://pinelakeroboticsteam.lovable.app) — pinelakeroboticsteam.lovable.app

A small React + Vite site for the Pinelake Robotics Team. Built with TypeScript, Tailwind CSS, and Supabase backend functions for server-side features.

## Key features

- Vite + React + TypeScript frontend
- Tailwind CSS styling with shadcn/ui components
- Supabase functions for chat, contact email, blog posts, and image upload
- Blog pages and CMS-like add post function (serverless via Supabase)

## Quick start

Prerequisites:
- Node.js 18+ (or Bun if you prefer)
- Git

Install dependencies:

```bash
npm install
# or with bun
# bun install
```

Run development server:

```bash
npm run dev
# or with pnpm: pnpm dev
# preview build
npm run preview
```

Build for production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Project structure (important files)

- `src/` — React source files
	- `components/` — UI and shared components (shadcn/ui)
	- `pages/` — page routes: `Home`, `Blog`, `BlogPost`, `Contact`, `Wiki`, `Tournaments`
	- `integrations/supabase/` — Supabase client and types
	- `supabase/functions/` — serverless functions used by the app

- `public/` — static assets
- `tailwind.config.ts` — Tailwind config
- `vite.config.ts` — Vite config

## Supabase functions

The repository contains several Supabase Edge Functions in `supabase/functions/`:

- `chat` — server endpoint for chatbot interactions
- `create-blog-post` — handles blog post creation
- `send-contact-email` — sends contact form emails
- `upload-blog-images` — handles blog image uploads

When deploying, ensure your Supabase project has the required environment variables set and the functions are deployed.

## Environment variables

Configure environment variables for Supabase (in your hosting platform or `.env` for local dev):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(For Edge Functions, set appropriate `SUPABASE_SERVICE_ROLE_KEY` or similar secrets on the server.)

### Recommended CI / Deploy secrets

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — (only set for server-side builds/functions; keep secret)

Be careful not to expose service role keys to client-side bundles.

## Contributing

- Create a fork and open a PR targeting `main`.
- Run `npm run lint` and `npm run build` before opening PRs.
- Keep UI changes consistent with existing `components/ui` patterns.

## Deployments

### Lovable (current)

The site is published on Lovable at `pinelakeroboticsteam.lovable.app`. Use the Lovable dashboard to manage domain settings, environment variables, and redeploys.

### Vercel / Netlify (quick guide)

- Connect your GitHub repository to Vercel or Netlify.
- Set the environment variables listed above in the project settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Build command: `npm run build`
- Output directory: `dist`

After connecting the repo and setting env vars, trigger a deploy by pushing to `main` or opening a PR.

## Continuous Integration (GitHub Actions)

A sample GitHub Actions workflow is included in `.github/workflows/ci.yml`. It runs on `push` and `pull_request` and performs:
- Node install and caching
- `npm run lint`
- `npm run build`

You can enable the workflow via the GitHub Actions UI. If your CI needs to test Supabase functions or run integration tests, add secrets in the repository `Settings -> Secrets` (for example, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

## Notes

- This project uses Vite; scripts are in `package.json` (`dev`, `build`, `preview`, `lint`).
- `bun.lockb` exists in the repo if you prefer Bun as the runtime.

---
