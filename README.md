# 🏛️ Grant Management Portal

A full-stack **Secure Grant Management Portal** with Role-Based Access Control (RBAC), JWT authentication, and a modern React frontend.

## 🏗️ Architecture

```
grant-portal/
├── backend/                # Node.js + Express REST API
│   ├── src/
│   │   ├── controllers/    # Business logic (auth, grants, applications, users, notifications)
│   │   ├── db/             # NeDB database setup + seed script
│   │   ├── middleware/     # Auth (JWT), RBAC, validation, error handling
│   │   ├── routes/         # Express route definitions
│   │   ├── utils/          # JWT helpers, response formatters
│   │   └── server.js       # Express app entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/               # React + Vite + TypeScript
    ├── src/
    │   ├── api/            # Axios client + service functions
    │   ├── components/     # Reusable UI components + layout
    │   ├── context/        # AuthContext (React Context API)
    │   ├── pages/          # Route-level page components
    │   ├── types/          # TypeScript interfaces
    │   └── utils/          # Formatters, helpers
    └── package.json
```

## 🔐 Roles & Permissions

| Feature               | Admin | Grant Manager | Applicant |
|-----------------------|:-----:|:-------------:|:---------:|
| View grants           | ✅    | ✅            | ✅ (open) |
| Create/edit grants    | ✅    | ✅            | ❌        |
| Delete grants         | ✅    | ❌            | ❌        |
| Submit applications   | ❌    | ❌            | ✅        |
| View all applications | ✅    | ✅            | own only  |
| Review applications   | ✅    | ✅            | ❌        |
| Manage users          | ✅    | ❌            | ❌        |
| View dashboard stats  | ✅    | ✅            | limited   |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Backend Setup

```bash
cd backend
cp .env.example .env          # Edit JWT secrets at minimum
npm install
npm run seed                  # Creates demo data + users
npm run dev                   # Starts on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev                   # Starts on http://localhost:5173
```

### 3. Open the app

Navigate to **http://localhost:5173**

### Demo Credentials

| Role          | Email                        | Password      |
|---------------|------------------------------|---------------|
| Admin         | admin@grantportal.com        | Admin@123     |
| Grant Manager | manager@grantportal.com      | Manager@123   |
| Applicant     | applicant@grantportal.com    | Applicant@123 |

## 🔑 Environment Variables (backend/.env)

| Variable                | Description                          | Default              |
|-------------------------|--------------------------------------|----------------------|
| `PORT`                  | API server port                      | `5000`               |
| `JWT_SECRET`            | Secret for access tokens             | **change this!**     |
| `JWT_REFRESH_SECRET`    | Secret for refresh tokens            | **change this!**     |
| `JWT_EXPIRES_IN`        | Access token TTL                     | `15m`                |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token TTL                    | `7d`                 |
| `CLIENT_URL`            | Frontend URL for CORS                | `http://localhost:5173` |
| `DB_PATH`               | Path to NeDB data files              | `./data`             |

## 📡 API Endpoints

### Auth
| Method | Endpoint              | Access  | Description              |
|--------|-----------------------|---------|--------------------------|
| POST   | `/api/auth/register`  | Public  | Register new user        |
| POST   | `/api/auth/login`     | Public  | Login, get tokens        |
| POST   | `/api/auth/refresh`   | Public  | Rotate refresh token     |
| POST   | `/api/auth/logout`    | Public  | Invalidate refresh token |
| GET    | `/api/auth/me`        | Auth    | Get current user         |

### Grants
| Method | Endpoint              | Access         | Description              |
|--------|-----------------------|----------------|--------------------------|
| GET    | `/api/grants`         | Auth           | List grants (paginated)  |
| GET    | `/api/grants/stats`   | Admin/Manager  | Dashboard statistics     |
| GET    | `/api/grants/:id`     | Auth           | Get grant details        |
| POST   | `/api/grants`         | Admin/Manager  | Create grant             |
| PUT    | `/api/grants/:id`     | Admin/Manager  | Update grant             |
| DELETE | `/api/grants/:id`     | Admin only     | Delete grant             |

### Applications
| Method | Endpoint                       | Access         | Description           |
|--------|--------------------------------|----------------|-----------------------|
| GET    | `/api/applications`            | Auth           | List applications     |
| GET    | `/api/applications/:id`        | Auth           | Get application       |
| POST   | `/api/applications`            | Applicant      | Submit application    |
| PATCH  | `/api/applications/:id/review` | Admin/Manager  | Review application    |
| DELETE | `/api/applications/:id`        | Auth           | Withdraw application  |

### Users (Admin)
| Method | Endpoint                        | Access | Description           |
|--------|---------------------------------|--------|-----------------------|
| GET    | `/api/users`                    | Admin  | List all users        |
| PUT    | `/api/users/:id/role`           | Admin  | Change user role      |
| PATCH  | `/api/users/:id/toggle-active`  | Admin  | Activate/deactivate   |
| PUT    | `/api/users/profile`            | Auth   | Update own profile    |
| PUT    | `/api/users/password`           | Auth   | Change own password   |

### Notifications
| Method | Endpoint                         | Access | Description           |
|--------|----------------------------------|--------|-----------------------|
| GET    | `/api/notifications`             | Auth   | Get my notifications  |
| PATCH  | `/api/notifications/:id/read`    | Auth   | Mark one as read      |
| PATCH  | `/api/notifications/read-all`    | Auth   | Mark all as read      |
| DELETE | `/api/notifications/:id`         | Auth   | Delete notification   |

## 🛡️ Security Features

- **JWT Access + Refresh Token rotation** — short-lived access (15m), rotated refresh (7d)
- **bcrypt password hashing** — cost factor 12
- **Helmet.js** — sets secure HTTP headers
- **Rate limiting** — 200 req/15min globally, 20 req/15min on auth routes
- **CORS** — restricted to frontend origin
- **Input validation** — express-validator on all mutation endpoints
- **RBAC middleware** — role checks on every protected route

## 🗄️ Database

Uses **NeDB** (embedded, zero-config, MongoDB-like API). Data files stored in `backend/data/`:
- `users.db`
- `grants.db`
- `applications.db`
- `notifications.db`
- `refresh_tokens.db`

To reset the database: `npm run seed` (clears and re-seeds all collections).

## 🛠️ Tech Stack

**Backend:** Node.js · Express · NeDB · JWT · bcryptjs · Helmet · express-validator  
**Frontend:** React 18 · Vite · TypeScript · Tailwind CSS · React Router v6 · Axios · React Hook Form · React Hot Toast · Lucide Icons

---

## 🎥 Project Demo Video

Watch the complete project demonstration here:

**Google Drive:**  
https://drive.google.com/file/d/1X7_TY0mxAsgznbOu7nt-pMj3egBovZXW/view?usp=sharing