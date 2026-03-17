# 🚁 Rescue Wings — Disaster Rescue Coordination Platform

**A full-stack real-time web application for disaster rescue coordination, volunteer management, and emergency alerts.**

![Tech Stack](https://img.shields.io/badge/Stack-MERN-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Screenshots](#screenshots)

---

## ✨ Features

### 👤 Citizens
- Register/login and submit SOS emergency requests
- Share live GPS location with rescue teams
- Upload disaster images
- Track rescue status in real-time
- Chat with assigned volunteer
- View emergency alerts and shelter info

### 🦺 Volunteers
- Register and apply to become a verified volunteer
- View nearby rescue requests on interactive map
- Accept missions and update status in real-time
- Communicate with victims via built-in chat
- Set availability status (available/busy/offline)

### 🛡️ Administrators
- Manage and approve volunteer registrations
- Monitor all rescue operations
- Broadcast emergency alerts to all users
- View analytics dashboard
- Control disaster zone mapping

### 🔄 Real-Time Features (Socket.io)
- Live rescue request notifications
- Volunteer assignment updates
- Real-time chat with typing indicators
- Emergency alert broadcasts

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS |
| Maps | Leaflet.js + React-Leaflet |
| Real-time | Socket.io |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| File Upload | Multer |
| HTTP Client | Axios |

---

## 📁 Project Structure

```
rescue-wings/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # DashboardLayout, Navbar
│   │   │   └── map/           # Leaflet MapComponent
│   │   ├── context/           # AuthContext, SocketContext
│   │   ├── pages/             # All page components
│   │   ├── services/          # API calls, Socket service
│   │   └── App.jsx
│   └── package.json
│
├── server/                    # Node.js Backend
│   ├── config/
│   │   └── socket.js          # Socket.io configuration
│   ├── controllers/           # Business logic
│   │   ├── authController.js
│   │   ├── rescueController.js
│   │   ├── volunteerController.js
│   │   ├── alertController.js
│   │   └── chatController.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification + RBAC
│   │   └── upload.js          # Multer file upload
│   ├── models/                # Mongoose schemas
│   │   ├── User.js
│   │   ├── RescueRequest.js
│   │   ├── Volunteer.js
│   │   ├── Alert.js
│   │   └── ChatMessage.js
│   ├── routes/                # Express routes
│   └── server.js
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/your-username/rescue-wings.git
cd rescue-wings
```

### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 3. Configure environment
```bash
cd server
cp .env.example .env
# Edit .env with your values
```

### 4. Seed admin user (optional)
```bash
cd server
node scripts/seed.js
```

### 5. Run in development
```bash
# From root directory (runs both client + server)
npm run dev

# Or separately:
cd server && npm run dev    # Backend on :5000
cd client && npm run dev    # Frontend on :5173
```

---

## 🪟 Standalone Windows EXE (Offline Desktop)

This repository now includes an Electron desktop wrapper that runs the app fully offline with embedded backend + embedded MongoDB.

### Runtime behavior
- App launches in a native Electron window (no browser tab).
- Local MongoDB starts automatically using embedded `mongod.exe`.
- Backend starts automatically on `http://127.0.0.1:5000`.
- Frontend is served from bundled `client/dist`.
- Persistent data is stored in `%APPDATA%/Rescue Wings/db`.
- Default admin is auto-created on first launch:
   - Email: `admin@app.com`
   - Password: `Admin@123`
   - Role: `admin`

### Build steps
```bash
# from project root
npm install
npm --prefix server install

# optional helper to fetch mongod.exe (or copy your own to resources/mongodb/win32-x64/mongod.exe)
npm run desktop:fetch-mongo

# build web + backend binary + electron package
npm run build:desktop:web
npm --prefix server run build:bin
npx electron-builder --win nsis
npx electron-builder --win portable
```

### Output files
- `release/RescueWings-Setup.exe`
- `release/RescueWings-Portable.exe`

---

## 🔧 Environment Variables

### Server (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/rescue-wings?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173,https://your-app.vercel.app

# Email OTP (Gmail App Password - recommended)
MAIL_FROM="Rescue Wings <your_email@gmail.com>"
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# OR generic SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Optional: Cloudinary for image uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional: Twilio for SMS alerts
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE=+1234567890
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/verify-otp` | ❌ | Verify email OTP |
| POST | `/api/auth/resend-otp` | ❌ | Resend email OTP |
| POST | `/api/auth/login` | ❌ | Login and get JWT |
| GET | `/api/auth/profile` | ✅ | Get current user profile |
| PUT | `/api/auth/profile` | ✅ | Update profile |

### Rescue Requests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/rescue/create` | ✅ | Create rescue request (multipart) |
| GET | `/api/rescue/all` | ✅ | Get all requests (with filters) |
| GET | `/api/rescue/nearby` | ✅ | Get geospatially nearby requests |
| GET | `/api/rescue/:id` | ✅ | Get single request with history |
| PUT | `/api/rescue/update/:id` | ✅ Vol/Admin | Update status |
| DELETE | `/api/rescue/:id` | ✅ | Delete request |

### Volunteers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/volunteer/apply` | ✅ | Apply as volunteer |
| GET | `/api/volunteer/list` | ✅ | List volunteers |
| PUT | `/api/volunteer/approve/:id` | ✅ Admin | Approve/reject volunteer |
| PUT | `/api/volunteer/availability` | ✅ Vol | Update availability |

### Alerts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/alerts/create` | ✅ Admin | Broadcast alert |
| GET | `/api/alerts/all` | ❌ | Get all alerts |
| PUT | `/api/alerts/:id/deactivate` | ✅ Admin | Deactivate alert |

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/send` | ✅ | Send message |
| GET | `/api/chat/messages/:userId` | ✅ | Get conversation history |
| GET | `/api/chat/conversations` | ✅ | Get all conversations |

---

## 🌐 Deployment

### MongoDB Atlas + Vercel (Recommended)

1. Create a free cluster in [MongoDB Atlas](https://www.mongodb.com/atlas).
2. In Atlas, create a database user and allow your app IP access (`0.0.0.0/0` for quick setup).
3. Copy the Atlas connection string and set `MONGODB_URI`.
4. Push this repository to GitHub.
5. Import project in Vercel (root project directory: repository root).
6. In Vercel project settings, add environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRE`
   - `CLIENT_URL` (example: `https://your-app.vercel.app`)
   - Mail variables (`GMAIL_USER` + `GMAIL_APP_PASSWORD` or SMTP vars)
7. Deploy. Vercel will:
   - Build frontend from `client/`
   - Serve backend API from `server/vercel.js`
   - Route `/api/*` and `/uploads/*` to backend function

### Notes for Vercel
- Set `VITE_API_URL=/api` in `client/.env` for same-domain API calls.
- WebSocket features can be limited on serverless platforms; core REST API features work normally.

### Option C: Docker
```bash
# Build and run
docker-compose up --build

# docker-compose.yml included in repo
```

---

## 🔒 Security Features
- JWT authentication with expiry
- Password hashing with bcrypt (12 salt rounds)
- Role-based access control (citizen/volunteer/admin)
- Express rate limiting (100 req/15min global, 10 req/15min auth)
- Input validation
- Secure file upload (type filtering, size limits)
- CORS protection

---

## 📱 Mobile Support
The UI is fully responsive with:
- Collapsible sidebar navigation
- Mobile-optimized forms
- Touch-friendly buttons and maps

---

## 🎯 Demo Credentials
After seeding:
- **Admin:** admin@rescue.com / admin123
- **Volunteer:** volunteer@rescue.com / vol123

---

## 📞 Emergency Lines (India)
- 🆘 National Emergency: **112**
- 🚒 Fire: **101**
- 🚑 Ambulance: **108**
- 👮 Police: **100**
- 🌊 Disaster Management: **1078**

---

## 📄 License
MIT — See LICENSE file for details.

---

*Built with ❤️ to save lives during disasters*
