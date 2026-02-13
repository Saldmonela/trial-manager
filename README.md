# Trial Manager

A modern, family-focused trial account management application built with **React 19**, **Vite**, **Supabase**, and **Tailwind CSS 4**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-7-646CFF)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20DB-3ECF8E)

## Overview

Trial Manager helps families track shared subscription accounts. It offers a secure, real-time dashboard to manage login credentials, expiry dates, and member access.

### Key Features

- **Dashboard**: Visual overview of all family subscriptions.
- **Real-time Updates**: Live synchronization of data across devices.
- **Security**: Client-side encryption for sensitive password storage.
- **Member Management**: Track who has access to which account.

## Documentation

- **[Architecture](./docs/architecture.md)**: High-level overview, tech stack, and database design.
- **[Component Library](./docs/components.md)**: Details on UI/Feature components and hooks.
- **[Development Guide](./docs/development.md)**: Setup instructions to run the project locally.
- **[Testing Strategy](./docs/testing.md)**: How to run and write tests.
- **[Deployment](./docs/deployment.md)**: Building and deploying to production.

## Quick Start

1.  **Clone & Install**:

    ```bash
    git clone <repo-url>
    npm install
    ```

2.  **Setup Environment**:
    Create `.env` with your Supabase keys (see [Development Guide](./docs/development.md)).

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

## License

This project is licensed under the MIT License.
