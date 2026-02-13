---
title: Project Summary
description: Overview of the Trial-Manager application architecture and features
author: Salman Lukman
date: 2026-02-13
---

# Trial-Manager 📚

**Trial-Manager** is a modern, streamlined application designed to track and manage trial accounts and subscriptions. It provides a centralized dashboard for monitoring expiry dates, managing family/account details, and tracking associated members, ensuring you never miss a renewal or lose track of shared access.

## 🚀 Key Features

- **Family Management**: Track service names, owner emails, and encrypted passwords.
- **Expiry Alerts**: Visual indicators and color-coded badges for trials expiring soon.
- **Member Tracking**: Detailed lists of members associated with each family/trial.
- **Secure Storage**: AES-256-GCM encryption for sensitive account information.
- **Realtime Updates**: Instant synchronization across devices using Supabase Realtime.
- **Responsive Design**: Optimized for both desktop and mobile viewing.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/)
- **Build System**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **State Management**: React Context & Hooks
- **Testing**: [Vitest](https://vitest.dev/) & React Testing Library

## 🏗️ Architecture

The application follows a modular, component-based architecture:

1.  **UI Layer**: Built with React and Tailwind CSS, focused on performance and accessibility.
2.  **Logic Layer**: Custom hooks (`useSupabaseData`, `useCrypto`) encapsulate business logic and data fetching.
3.  **Data Layer**: Supabase handles authentication, PostgreSQL database, and realtime listeners.
4.  **Security**: Passwords are encrypted before storage and decrypted only when viewed.

## 📁 Project Structure

| Directory         | Description                             |
| :---------------- | :-------------------------------------- |
| `src/components/` | Reusable UI and feature components.     |
| `src/context/`    | Global states (Theme, Language).        |
| `src/hooks/`      | Core custom hooks for data and logic.   |
| `src/lib/`        | Utility functions and library wrappers. |
| `docs/`           | Detailed technical documentation.       |

## 🏁 Getting Started

To run the project locally:

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Set up your `.env` with Supabase credentials.
4.  Start the dev server: `npm run dev`

---

> [!NOTE]
> For more detailed information, see the documents in the `docs/` folder.
