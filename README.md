# HELLOHACKS Career Matcher

A lightweight React + Vite app that helps users explore **jobs** and **training paths** by matching personal skills and completed courses to job requirements. It uses **Supabase** for data (jobs, courses) and localStorage for quick profile persistence.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema (Supabase)](#database-schema-supabase)
- [How It Works](#how-it-works)
- [Available Scripts](#available-scripts)
- [Deploy](#deploy)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Two search modes (diagonal UI)**
  - **Employment**: search by job title/company; view required skills and recommended courses by overlap.
  - **Skills or Courses**: enter skills/course codes to rank jobs by coverage and matches.
- **Profile management**
  - Edit user details; drag-and-drop courses between **Completed** and **Available**.
  - Resume upload (client-side validation, up to 8MB).
  - Persists skills & completed course codes to `localStorage` for reuse.
- **Elegant UI**
  - Modern CSS with glass/gradient effects, responsive layout, accessible focus states.
- **Supabase integration**
  - `jobs` and `courses` tables queried directly from the client.

---

## Tech Stack

- **Frontend:** React (Vite), modern CSS
- **Auth/DB:** Supabase (JS client)
- **Linting:** ESLint
- **Tooling:** Node.js, npm

---

## Project Structure

```
my-app/
├─ public/
├─ src/
│  ├─ assets/
│  │  ├─ Group 2.png
│  │  └─ react.svg
│  ├─ components/
│  │  ├─ LoginModal.css
│  │  ├─ LoginModal.jsx
│  │  └─ TopBar.jsx
│  ├─ data/
│  │  └─ profile.js
│  ├─ pages/
│  │  ├─ Home.jsx
│  │  ├─ Profile.css
│  │  └─ Profile.jsx
│  ├─ App.css
│  ├─ App.jsx
│  ├─ index.css
│  ├─ main.jsx
│  └─ SupaBaseClient.jsx
├─ .env.local (not included)
├─ index.html
├─ package.json
├─ vite.config.js
└─ ... (node_modules, etc.)
```

---

## Getting Started

### 1) Prerequisites
- **Node.js** 18+ (recommended)  
- A **Supabase** project with `URL` and `anon` key.

### 2) Install
```bash
npm install
```

### 3) Configure environment
Create **`.env.local`** in project root:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

> The app reads these in `src/SupaBaseClient.jsx`.

### 4) Run dev server
```bash
npm run dev
```
Vite will print a local URL (usually `http://localhost:5173`).

### 5) If error, run the following: 
#### Allows Powershell to run all scripts without prompt for confirmation for this session only
```bash
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
#### Downloads the supabase-js library
```bash
npm i @supabase/supabase-js
```

---

## Environment Variables

| Name                    | Required | Description                         |
|-------------------------|----------|-------------------------------------|
| `VITE_SUPABASE_URL`     | ✅       | Your Supabase project URL           |
| `VITE_SUPABASE_ANON_KEY`| ✅       | Public anon key for the project     |

> Vite requires variables to be prefixed with `VITE_` to be exposed to the client.

---

## Database Schema (Supabase)

The app expects two tables: **`jobs`** and **`courses`**.

### `jobs`
| column        | type         | notes                                                            |
|---------------|--------------|------------------------------------------------------------------|
| `id`          | bigint / int | primary key                                                      |
| `title`       | text         | job title                                                        |
| `company`     | text         | company name (optional)                                          |
| `skills-req`* | text/json    | **required skills** (array JSON or comma string)                 |

> *Code is tolerant of either `skills-req` **or** `skills_req`. It reads whichever exists.

**Example rows:**
```json
[
  { "id": 1, "title": "Data Analyst", "company": "Acme", "skills-req": ["sql", "excel", "python"] },
  { "id": 2, "title": "Frontend Developer", "company": "Beta", "skills-req": "javascript, react, css" }
]
```

### `courses`
| column    | type         | notes                                                          |
|-----------|--------------|----------------------------------------------------------------|
| `id`      | bigint / int | primary key                                                    |
| `code`    | text         | course code (e.g., "CPSC 110")                                 |
| `name`    | text         | course name                                                    |
| `skills`  | text/json    | **covered skills** (array JSON or comma string)                |

**Example rows:**
```json
[
  { "id": 10, "code": "CPSC 110", "name": "Computation, Programs, and Programming", "skills": ["python", "problem solving"] },
  { "id": 11, "code": "STAT 200", "name": "Elementary Statistics", "skills": "statistics, probability, excel" }
]
```

> Arrays or comma-separated strings are accepted; the UI normalizes them.

---

## How It Works

### Pages
- **`/` (Home.jsx)**  
  - Two modes:
    - **Employment**: Search jobs by title/company (debounced). Selecting a job shows:
      - Required skills
      - Your progress vs Profile’s saved skills
      - Recommended courses based on skill overlap
    - **Skills or Courses**: Enter *course codes or skills* (comma separated). The app:
      - Expands course codes into skills via `courses.skills`
      - Ranks jobs by coverage & matches
- **`/profile` (Profile.jsx)**  
  - Edit personal details (name, contact, location, employment).
  - Drag-and-drop courses between **Completed** and **Available**.
  - Upload resume (PDF/DOC/DOCX/TXT, ≤8MB).
  - Persists:
    - `profileCourseCodes` (array of completed course codes)
    - `profileSkills` (unique skills derived from completed courses)

### Local Storage Keys
- `activeUser` (used to resolve a fake profile in demo mode)
- `isLoggedIn` (for simple nav protection)
- `fake_profiles` (optional: seed data for demo)
- `profileCourseCodes`, `profileSkills` (derived from Profile page)

---

## Available Scripts

```bash
# start dev server
npm run dev

# production build
npm run build

# preview production build locally
npm run preview

# (optional) lint
npm run lint
```

---

## Deploy

### Netlify / Vercel
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **Environment Variables**.
- Build command: `npm run build`
- Output dir: `dist`

### Static hosting
- Run `npm run build` and serve the `dist/` folder with any static server (e.g., `npx serve dist`).

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/awesome-thing`
3. Commit your changes: `git commit -m "feat: add awesome thing"`
4. Push the branch: `git push origin feat/awesome-thing`
5. Open a Pull Request 🎉

---

## License

MIT © 2025 HELLOHACKS GitHappens
