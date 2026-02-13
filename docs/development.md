# Development Guide

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v18 or higher recommended.
- **npm** (Node Package Manager).
- **Git**.

## Installation

1.  **Clone the repository**:

    ```bash
    git clone <repository-url>
    cd trial-manager
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Environment Setup

Create a `.env` or `.env.local` file in the project root with your Supabase credentials.

```ini
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Note**: You can find these credentials in your Supabase project settings under **API**.

## Running Locally

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

## Building regarding Production

To build the project for production:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Linting

To check for code style and potential errors:

```bash
npm run lint
```
