# Deployment Guide

## Build Process

The application is built using Vite, which bundles the code for production.

1.  **Run the build command**:

    ```bash
    npm run build
    ```

    This generates a `dist/` directory containing the optimized static assets (HTML, CSS, JS).

2.  **Preview locally**:
    To verify the build works before deploying:
    ```bash
    npm run preview
    ```

## Supabase Configuration

Ensure your production Supabase project matches your local development environment.

1.  **Database Schema**: Apply the schema from `supabase_schema.sql` to your production database’s SQL Editor.
2.  **Auth Settings**:
    - Enable **Email/Password** provider.
    - Enable **Google** provider (if used) and configure Client ID/Secret.
    - Set the **Site URL** and **Redirect URLs** in Supabase Auth settings to your production domain (e.g., `https://your-app.vercel.app` and `https://your-app.vercel.app/**`).

## Hosting Providers

Since this is a static site (SPA), it can be hosted on any static site provider.

### Vercel (Recommended)

1.  Connect your GitHub repository to Vercel.
2.  Vercel will detect Vite automatically.
3.  Add the environment variables in the Vercel dashboard:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
4.  Deploy.

### Netlify

1.  New site from Git.
2.  Build command: `npm run build`
3.  Publish directory: `dist`
4.  Add environment variables in "Site settings" > "Build & deploy" > "Environment".
5.  **Important**: For React Router to work on refresh, create a `_redirects` file in the `public/` folder with:
    ```
    /*  /index.html  200
    ```
