# NTS Films CRM

A full-featured CRM and client portal for videography businesses. Built with React, Node.js/Express, and SQLite.

![NTS Films Dashboard](docs/dashboard-preview.png)

## Features

### For Business Owners (Admin)
- **Lead Management**: Capture leads via website inquiry form, track status, convert to clients
- **Client Management**: Store contact info, project history, notes, and communications
- **Project Tracking**: Full workflow from inquiry → filming → editing → delivery
- **Questionnaires**: Create custom questionnaires, send to leads/clients, view responses
- **Invoicing**: Create, send, and track invoices with payment status
- **Calendar**: Schedule filming sessions, manage availability, send reminders
- **Insights Dashboard**: Track leads, conversion rates, revenue, project stats
- **Automation**: Auto-notifications for questionnaire submissions, overdue invoices, filming reminders

### For Clients (Portal)
- **Personal Dashboard**: View project status, upcoming dates, pending invoices
- **Project Progress**: Track milestones and see real-time progress
- **File Uploads**: Share inspiration images, paperwork, contracts
- **Questionnaires**: Fill out forms online (wedding details, creative briefs, etc.)
- **Invoices**: View and track invoice status
- **Scheduling**: Book available time slots for filming

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, React Router, Zustand
- **Backend**: Node.js, Express.js
- **Database**: SQLite (via better-sqlite3) - easy to deploy, no setup required
- **Authentication**: JWT tokens
- **Styling**: TailwindCSS with custom dark theme

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ntsfilms.git
cd ntsfilms
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Initialize database with sample data**
```bash
npm run seed
```

5. **Start backend server**
```bash
npm run dev
```

6. **Install frontend dependencies** (new terminal)
```bash
cd frontend
npm install
```

7. **Start frontend dev server**
```bash
npm run dev
```

8. **Open in browser**
- Frontend: http://localhost:3000
- API: http://localhost:5000

### Demo Credentials
- **Admin**: admin@ntsfilms.com / admin123
- **Client**: emily@example.com / client123

## Project Structure

```
ntsfilms/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js      # SQLite setup & schema
│   │   │   └── seed.js          # Sample data
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js          # Login, register, profile
│   │   │   ├── leads.js         # Lead CRUD
│   │   │   ├── clients.js       # Client CRUD
│   │   │   ├── projects.js      # Project & task management
│   │   │   ├── questionnaires.js
│   │   │   ├── invoices.js
│   │   │   ├── calendar.js
│   │   │   ├── insights.js
│   │   │   ├── uploads.js
│   │   │   └── public.js        # Public inquiry form
│   │   ├── services/
│   │   │   └── automation.js    # Scheduled tasks
│   │   └── index.js             # Express app
│   ├── data/                    # SQLite database file
│   ├── uploads/                 # Uploaded files
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Header, DashboardLayout
│   │   │   └── ui/              # Reusable UI components
│   │   ├── pages/
│   │   │   ├── auth/            # Login, Register
│   │   │   ├── dashboard/       # Admin & Client dashboards
│   │   │   ├── leads/
│   │   │   ├── clients/
│   │   │   ├── projects/
│   │   │   └── public/          # Inquiry form, questionnaire
│   │   ├── stores/              # Zustand state management
│   │   ├── utils/
│   │   │   └── api.js           # Axios API client
│   │   ├── styles/
│   │   │   └── index.css        # TailwindCSS + custom styles
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update profile
- `PUT /api/auth/password` - Change password

### Leads (Admin only)
- `GET /api/leads` - List all leads
- `GET /api/leads/:id` - Get lead details
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/:id/convert` - Convert to client

### Clients
- `GET /api/clients` - List all clients (admin)
- `GET /api/clients/:id` - Get client details
- `POST /api/clients` - Create client (admin)
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client (admin)

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project with tasks
- `POST /api/projects` - Create project (admin)
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project (admin)
- `PUT /api/projects/:id/tasks/:taskId` - Update task
- `POST /api/projects/:id/tasks` - Add task (admin)

### Questionnaires
- `GET /api/questionnaires` - List questionnaires
- `POST /api/questionnaires` - Create questionnaire (admin)
- `POST /api/questionnaires/:id/link` - Generate shareable link

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice (admin)
- `PUT /api/invoices/:id` - Update invoice
- `POST /api/invoices/:id/send` - Send invoice notification

### Calendar
- `GET /api/calendar` - List events
- `GET /api/calendar/available-slots` - Get bookable slots
- `POST /api/calendar` - Create event (admin)
- `POST /api/calendar/book/:slotId` - Book a slot
- `POST /api/calendar/generate-slots` - Generate availability (admin)

### Public (No auth)
- `POST /api/public/inquiry` - Submit lead inquiry
- `GET /api/public/questionnaire/:token` - Get questionnaire
- `POST /api/public/questionnaire/:token` - Submit response

## Deployment

### Option 1: VPS / Dedicated Server

1. **Install Node.js on server**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Clone and setup**
```bash
git clone https://github.com/yourusername/ntsfilms.git
cd ntsfilms/backend
npm install --production
cp .env.example .env
# Edit .env with production values
npm run seed
```

3. **Build frontend**
```bash
cd ../frontend
npm install
npm run build
```

4. **Use PM2 for process management**
```bash
npm install -g pm2
cd ../backend
pm2 start src/index.js --name ntsfilms
pm2 save
pm2 startup
```

5. **Setup Nginx reverse proxy**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://localhost:5000;
    }

    location / {
        root /var/www/ntsfilms/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 2: Docker

```dockerfile
# Dockerfile (backend)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "src/index.js"]
```

### Option 3: Railway / Render / Fly.io

These platforms support Node.js apps directly. Just connect your repository and configure:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables from `.env.example`

## Extending the System

### Adding New Service Types
Edit `serviceTypes` array in:
- `frontend/src/pages/leads/Leads.jsx`
- `frontend/src/pages/projects/Projects.jsx`
- `backend/src/routes/public.js`

### Adding Email Notifications
1. Configure SMTP in `.env`
2. Uncomment nodemailer setup in `backend/src/services/automation.js`
3. Add email templates

### Integrating Payment Gateway
1. Add Stripe/PayPal SDK to backend
2. Create payment routes
3. Update invoice status on webhook

### Adding SMS Notifications
1. Add Twilio SDK
2. Create SMS service in `backend/src/services/`
3. Trigger from automation service

## License

MIT License - feel free to use for personal or commercial projects.

## Support

For questions or issues, please open a GitHub issue or contact support@ntsfilms.com
