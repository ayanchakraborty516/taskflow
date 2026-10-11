# TaskFlow — High-Velocity Team Project Management

TaskFlow is a full-stack MERN (MongoDB, Express, React, Node.js) team project management web application engineered for speed, visual clarity, multi-tenant workspace isolation, and high developer ergonomics. The visual design system and interface components are built to match the technical minimalism and aesthetic specifications of the **Stitch AI TaskFlow Design System**.

---

## 🌟 Product Overview & Feature List

### 1. Multi-Tenant Workspace & Project Management
- **Strict Tenant Boundaries:** Data queries and operations are scoped to the active workspace (`req.workspace._id`). Users cannot access, view, edit, or delete projects, tasks, or activities belonging to other workspaces by guessing or tampering with IDs.
- **Granular Roles & Permissions:** Roles (`Owner`, `Admin`, `Member`, `Viewer`) enforced server-side. Viewers have read-only access and cannot create or modify resources.
- **Invitations & Member Management:** Reusable workspace invite codes and direct member invitation with instant role assignments.
- **Project Tracking:** Project categories, custom keys (e.g. `PRJ-101`), designated project leads, completion rate calculation, milestone target dates, and archiving.

### 2. Interactive Kanban Board & List Views
- **4 Workflow Lanes:** `To Do`, `In Progress`, `In Review`, and `Done`.
- **Drag-and-Drop via @dnd-kit:** Card movement between lanes with smooth drag overlay, optimistic client updates, column sorting, and backend state persistence.
- **Alternative List View:** Instant toggle between Kanban card board and structured list overview with inline status selectors and properties.
- **Task Attributes:** Unique auto-generated keys, priority badges (`urgent`, `high`, `medium`, `low`), due dates, custom labels, and assignee avatars.

### 3. Slide-Out Task Detail Drawer
- **Inline Editing:** Edit task titles and descriptions in-place.
- **Properties Grid:** Assignee dropdown, timezone-safe due date picker, priority level selector, and tag management.
- **Acceptance Criteria (Checklists):** Add subtasks, track completion percentages, and toggle subtask status.
- **Threaded Discussion & Comments:** Comment feed with author metadata, timestamps formatted with date and time, and permission-based deletion (author or workspace Owner/Admin only).

### 4. Live Dashboard & Analytics
- **Live Metric Summary Cards:** Active projects count, user-assigned tasks count, total and weekly completed task count, and overdue task triage.
- **Upcoming Deadlines Widget:** Displays deliverables due today or in the future sorted by date ascending, with urgency badges (*"Due today"*, *"Due tomorrow"*, *"In X days"*) and 1-click drawer inspection.
- **7-Day Completion Velocity Chart:** Visual bar chart showing daily completed tasks across the past 7 days based on actual workspace records.
- **Workspace Status Distribution:** Breakdown across `To Do`, `In Progress`, `In Review`, and `Done`.
- **First-Use Onboarding:** Hero onboarding banner when a workspace has 0 active projects or tasks, with clear setup actions.
- **Activity Audit Feed:** Live stream of recent workspace actions (task creation, status changes, comments).

### 5. Deliverables Calendar
- **Month Grid View:** Visual map of deliverables positioned by deadline date.
- **Month Navigation:** Previous, Next, and Today controls.
- **Project & Status Filtering:** Filter calendar cards by specific project or status (*All*, *To Do*, *In Progress*, *In Review*, *Done*).
- **Timezone-Safe Normalization:** Standardized `YYYY-MM-DD` date keys to prevent off-by-one day display shifts across differing UTC offsets.

### 6. Team & Notification Hubs
- **In-App Notification Center:** Notifications generated for task assignment, status updates, and comments. Supports filtering (*All* vs *Unread Only*), individual mark-as-read, 1-click mark-all-read, and removal.
- **Header & Sidebar Badges:** Real-time unread notification count badge.
- **Global Command Palette (`⌘K` / `Ctrl+K`):** Keyboard-driven search across workspace tasks, projects, and application pages.

---

## 🏗️ Architecture & Folder Structure

TaskFlow is organized as an npm workspaces monorepo containing a modular Express REST API backend and a Vite React SPA frontend:

```text
Taskflow/
├── package.json               # Monorepo root workspace orchestrator
├── .gitignore                 # Excludes node_modules, .env, build artifacts
├── .env.example               # Root environment configuration template
├── README.md                  # System documentation and deployment guide
│
├── server/                    # Node.js + Express + MongoDB REST API
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── app.js             # Express app, helmet, CORS, rate limiting, route mounts
│   │   ├── server.js          # DB connection & HTTP listener with graceful shutdown
│   │   ├── config/
│   │   │   └── db.js          # Mongoose connection with timeout & error handling
│   │   ├── models/            # User, Workspace, Project, Task, Comment, Activity, Notification
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT verification via HTTP-only cookie or Bearer header
│   │   │   ├── workspace.js   # Multi-tenant workspace resolution & role enforcement
│   │   │   └── errorHandler.js# Centralized error handler (CastError, validation, JWT)
│   │   ├── controllers/       # Business logic for all modules
│   │   ├── routes/            # Express router modules
│   │   ├── utils/
│   │   │   └── token.js       # JWT generation and HTTP-only cookie dispatcher
│   │   └── seeds/
│   │       └── seed.js        # Seeds demo team (Acme Studio), projects, tasks, comments
│   └── tests/                 # Jest + Supertest integration test suite
│       ├── setup.js           # Test database lifecycle
│       ├── health_api.test.js # Health check & 404 tests
│       ├── auth.test.js       # Register, login, cookies, profile tests
│       ├── workspace_isolation.test.js # Cross-tenant isolation verification
│       ├── projects_tasks.test.js      # Project & Task CRUD tests
│       └── phase3_features.test.js     # Dashboard, comments, notifications tests
│
└── client/                    # React 18 + Vite Frontend
    ├── package.json
    ├── vite.config.js         # Vite configuration with /api development proxy
    ├── index.html             # Google Fonts (Geist, Inter, Material Symbols)
    └── src/
        ├── main.jsx           # React DOM root entry point
        ├── App.jsx            # React Router v6 tree & context providers
        ├── index.css          # Stitch AI design system variables and utility styles
        ├── api/
        │   └── client.js      # Fetch API wrapper with workspace header & auth tokens
        ├── context/
        │   ├── AuthContext.jsx       # User auth state, login/logout, workspace switcher
        │   ├── ToastContext.jsx      # Non-blocking user feedback notifications
        │   └── TaskDrawerContext.jsx # Slide-out task drawer state
        ├── components/
        │   ├── AppShell.jsx          # Protected layout shell with responsive sidebar
        │   ├── Header.jsx            # Breadcrumbs, quick task button, notif badge
        │   ├── Sidebar.jsx           # Workspace navigation & workspace dropdown
        │   ├── TaskDrawer.jsx        # Task editor, checklists, discussion thread
        │   ├── TaskModal.jsx         # Quick task creation modal
        │   ├── ProjectModal.jsx      # Project creation and editing modal
        │   └── CommandPalette.jsx    # Cmd+K search modal
        ├── pages/
        │   ├── LandingPage.jsx       # Public marketing overview
        │   ├── LoginPage.jsx         # User login with demo account shortcuts
        │   ├── RegisterPage.jsx      # User registration & initial workspace setup
        │   ├── DashboardPage.jsx     # Sprint analytics, velocity chart, deadlines
        │   ├── ProjectsPage.jsx      # Projects grid and list views with filters
        │   ├── ProjectDetailPage.jsx # Single project overview & task list
        │   ├── KanbanPage.jsx        # Drag-and-drop board & alternative list view
        │   ├── CalendarPage.jsx      # Deliverables schedule with project/status filters
        │   ├── MyTasksPage.jsx       # Filterable assigned tasks list
        │   ├── NotificationsPage.jsx # In-app notification center
        │   ├── TeamPage.jsx          # Member management, roles, and invite codes
        │   ├── SettingsPage.jsx      # Profile, security, and workspace preferences
        │   └── NotFoundPage.jsx      # 404 handler
        └── __tests__/
            └── client_features.test.js # Vitest frontend unit tests
```

---

## 💻 Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Framework** | React 18 | Functional components, Hooks, JavaScript only (`.jsx` and `.js`) |
| **Bundler & Dev Server** | Vite 5 | Fast HMR, production minification, `/api` proxy |
| **Routing** | React Router v6 | Declarative client routing, nested protected routes |
| **Drag & Drop** | `@dnd-kit` | Accessible, touch-compatible Kanban board drag-and-drop |
| **Styling** | Vanilla CSS | Custom design system matching Stitch AI tokens (`Geist`, `Inter`) |
| **Backend Runtime** | Node.js (v18+) | Non-blocking asynchronous I/O |
| **API Framework** | Express 4 | RESTful routes, modular middleware architecture |
| **Database** | MongoDB 6+ | Document store with replica sets / Atlas support |
| **ODM** | Mongoose 8 | Schema validation, hooks, indexing, cascading logic |
| **Authentication** | JWT + Cookies | Signed HTTP-only cookies + Bearer token fallback |
| **Password Security** | Bcryptjs | Blowfish salted password hashing (cost factor 10) |
| **Security Headers** | Helmet | Cross-Origin resource policies, XSS/frame protection |
| **Rate Limiting** | Express-Rate-Limit| 100 requests / 15 min on `/api/auth` endpoints |
| **Testing** | Jest, Supertest, Vitest | End-to-end API tests and client unit tests |

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20.x` or `v22.x` recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance running on `localhost:27017` or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection URI

---

## ⚙️ Environment Variables

### Root / Server (`server/.env`)

| Variable | Required | Default (Dev) | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port for the Express server |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `production`, `test`) |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/taskflow` | Connection string to MongoDB database |
| `JWT_SECRET` | Yes | `taskflow_dev_secret_key` | Secret key for signing JSON Web Tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration |
| `CLIENT_URL` | Yes (Prod) | `http://localhost:5173` | Allowed CORS origin (comma-separated for multiples) |
| `COOKIE_SECRET` | No | `taskflow_cookie_signing_secret` | Secret for signed cookies |
| `COOKIE_SAMESITE`| No | `lax` (dev) / `none` (cross-site prod) | Cookie SameSite policy |

### Client (`client/.env`)

| Variable | Required | Default (Dev) | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api` | Base URL for API requests. Set to full URL if backend is on a separate domain (e.g. `https://api.yourdomain.com/api`). |

> **Security Note:** Never commit actual `.env` files to git. Template files [`.env.example`](file:///.env.example) and [`server/.env.example`](file:///server/.env.example) contain only placeholders.

---

## 🛠️ Local Installation and Run Commands

### 1. Install Dependencies
Install dependencies across both client and server workspaces from the root:
```bash
npm install
```

### 2. Configure Environment Files
Create local `.env` files from templates:
```bash
# Server configuration
cp server/.env.example server/.env
```

### 3. Seed Database with Demo Accounts
Populate local MongoDB with initial users, projects, Kanban tasks, comments, and activities:
```bash
npm run seed
```

Default demo accounts created:
- **Elena Vance (Product Lead / Owner):** `elena.vance@acmestudio.io` / `Password123!`
- **Liam Chen (Senior Software Engineer):** `liam.chen@acmestudio.io` / `Password123!`
- **Workspace Name:** `Acme Studio` (Invite code: `acme2026`)

### 4. Start Development Servers
Run the backend and frontend in separate terminals:

```bash
# Terminal 1: Start Express API server (port 5000)
npm run dev:server

# Terminal 2: Start Vite React client (port 5173)
npm run dev:client
```
Access the application in your browser at: **`http://localhost:5173`**

### 5. Production Build & Local Serve
Build the client and serve it through Express:
```bash
# Build client production bundle
npm run build

# Start production server
npm start
```
Access the application at: **`http://localhost:5000`**

---

## 🧪 Test Commands

The repository includes both backend integration tests and client unit tests:

```bash
# Run all tests (Server Jest integration suite + Client Vitest suite)
npm test

# Run backend tests only
npm run test:server

# Run frontend tests only
npm run test:client
```

### Test Suite Summary (47 total tests):
1. **`health_api.test.js`**: Health check `/api/health`, 404 handling, and route protection.
2. **`auth.test.js`**: Registration, login, duplicate email prevention, password hashing, and cookie verification.
3. **`workspace_isolation.test.js`**: Verifies that users cannot read, edit, move, or delete resources in other workspaces.
4. **`projects_tasks.test.js`**: Project CRUD, task key generation (`ASP-101`), checklist operations, and column moves.
5. **`phase3_features.test.js`**: Dashboard calculations, upcoming deadlines, 7-day velocity chart, comment permissions, notification dispatch, and unread counts.
6. **`client_features.test.js`**: Date timezone normalization (`getLocalDateKey`) and `ApiClient` header/token handling.

---

## 📡 API Overview

All routes except `/api/health`, `/api/auth/register`, and `/api/auth/login` require an authenticated session (`Bearer <token>` or HTTP-only cookie). Protected workspace routes also require an authorized workspace via the `x-workspace-id` header or the user's active workspace.

### Health
- `GET /api/health` — API server uptime and status check

### Authentication
- `POST /api/auth/register` — Register user and initialize default workspace
- `POST /api/auth/login` — Authenticate credentials and receive token/cookie
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Retrieve current user record and workspaces list
- `PUT /api/auth/profile` — Update user name, title, avatar, or active workspace
- `PUT /api/auth/password` — Change account password

### Workspaces
- `GET /api/workspaces` — List workspaces current user belongs to
- `POST /api/workspaces` — Create new workspace
- `GET /api/workspaces/:id` — Get workspace details and member roster
- `PUT /api/workspaces/:id` — Update workspace details (Owner/Admin)
- `POST /api/workspaces/join` — Join workspace via invite code
- `POST /api/workspaces/:id/members` — Invite/add member by email (Owner/Admin)
- `PUT /api/workspaces/:id/members/:userId` — Change member role (Owner/Admin)
- `DELETE /api/workspaces/:id/members/:userId` — Remove member (Owner/Admin)
- `POST /api/workspaces/:id/regenerate-invite` — Generate new invite code (Owner)

### Projects
- `GET /api/projects` — List workspace projects (supports `?search`, `?status`, `?category`)
- `POST /api/projects` — Create project (Members/Admins/Owners)
- `GET /api/projects/:id` — Get project details and completion stats
- `PUT /api/projects/:id` — Update project metadata
- `PUT /api/projects/:id/archive` — Toggle project archive state
- `DELETE /api/projects/:id` — Delete project and its associated tasks (Owner/Admin)

### Tasks
- `GET /api/tasks` — List tasks (supports `?project`, `?status`, `?assignee`, `?myTasks`, `?search`)
- `POST /api/tasks` — Create task with automatic key generation
- `GET /api/tasks/:id` — Get single task details
- `PUT /api/tasks/:id` — Update task title, status, priority, due date, assignee
- `POST /api/tasks/:id/move` — Update column status and order index (Kanban drag-and-drop)
- `POST /api/tasks/reorder` — Batch reorder tasks within or across lanes
- `PUT /api/tasks/:id/subtasks/:subtaskId` — Toggle subtask completion
- `DELETE /api/tasks/:id` — Delete task

### Comments
- `GET /api/comments/task/:taskId` — List comments for a task
- `POST /api/comments` — Add comment to task (dispatches notifications)
- `DELETE /api/comments/:id` — Delete comment (author or Owner/Admin only)

### Notifications
- `GET /api/notifications` — List notifications for user in workspace (supports `?unreadOnly=true`)
- `PUT /api/notifications/:id/read` — Mark notification as read
- `PUT /api/notifications/read-all` — Mark all notifications as read
- `DELETE /api/notifications/:id` — Delete notification

### Dashboard & Activity
- `GET /api/dashboard` — Calculate metrics, upcoming deadlines, velocity chart, and status counts
- `GET /api/activity` — Retrieve workspace activity audit trail

---

## 🌐 Production Deployment Guide

### 1. Database Setup: MongoDB Atlas
1. Create a free M0 cluster or dedicated cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Network Access**, add the IP address of your backend host (or `0.0.0.0/0` with secure authentication).
3. Under **Database Access**, create a database user with read and write privileges.
4. Copy your connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/taskflow?retryWrites=true&w=majority
   ```

---

### 2. Backend Deployment: Render (or Railway / Fly.io / Heroku)
1. In [Render](https://render.com), click **New +** > **Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add the following **Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/taskflow?retryWrites=true&w=majority
   JWT_SECRET=generate_a_secure_random_64_character_hex_string
   JWT_EXPIRES_IN=7d
   CLIENT_URL=https://your-taskflow-app.vercel.app
   COOKIE_SECRET=generate_another_secure_signing_secret_string
   COOKIE_SAMESITE=none
   ```
5. Deploy the service and note your public URL (e.g., `https://taskflow-api.onrender.com`).

---

### 3. Frontend Deployment: Vercel
1. In [Vercel](https://vercel.com), import your Git repository.
2. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add the following **Environment Variable**:
   ```env
   VITE_API_URL=https://taskflow-api.onrender.com/api
   ```
4. For Single Page Application routing on Vercel, ensure a [`vercel.json`](file:///client/vercel.json) rewrite file exists in `client/` if needed:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
5. Deploy the application and copy your public Vercel URL (e.g., `https://your-taskflow-app.vercel.app`).
6. Update the `CLIENT_URL` variable in your Render backend settings with your actual Vercel URL to complete CORS authorization.

---

## 🔒 Security Considerations

- **Multi-Tenant Isolation:** Database operations always enforce `workspace: req.workspace._id`. User requests cannot retrieve, mutate, or delete resources outside of their authorized workspace.
- **Dual Authentication Model:** Uses HTTP-only, SameSite-protected cookies for browser sessions, with dual Bearer token header support to ensure reliability across cross-origin deployments.
- **Password Protection:** Passwords are never stored in plain text. Hashed with `bcryptjs` (salt rounds: 10). Passwords are excluded from query results by default (`select: false`) and stripped during JSON serialization.
- **Rate Limiting:** Protects `/api/auth` endpoints from credential stuffing and brute force attempts (100 requests per 15 minutes per IP).
- **HTTP Security Headers:** Integrated with `helmet` to manage CSP, prevent MIME-type sniffing, and mitigate clickjacking.
- **CORS Whitelisting:** Strictly validates request origins in production against the configured `CLIENT_URL` whitelist.
- **No Committed Secrets:** Repository ignores `.env` files. The `.env.example` templates contain placeholders only.

---

## ⚠️ Known Limitations

1. **In-App Notification Delivery:** Notifications are stored in MongoDB and displayed live in the web application's notification center. No third-party email (SendGrid/Postmark) or SMS service is currently configured.
2. **Logical Multi-Tenancy:** Multi-tenancy uses row-level document scoping within a shared MongoDB database collection rather than separate database instances per tenant.
3. **Polling vs. WebSockets:** Real-time updates occur via user interactions, optimistic client state, and background refetching rather than an open WebSocket / Socket.io server connection.
