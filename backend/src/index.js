require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const questionnaireRoutes = require('./routes/questionnaires');
const invoiceRoutes = require('./routes/invoices');
const calendarRoutes = require('./routes/calendar');
const insightsRoutes = require('./routes/insights');
const uploadRoutes = require('./routes/uploads');
const publicRoutes = require('./routes/public');

// Import middleware
const { authenticateToken, isAdmin } = require('./middleware/auth');

// Import automation service
const automationService = require('./services/automation');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes (no auth required)
app.use('/api/public', publicRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/leads', authenticateToken, isAdmin, leadRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/questionnaires', authenticateToken, questionnaireRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/insights', authenticateToken, isAdmin, insightsRoutes);
app.use('/api/uploads', authenticateToken, uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // Handle React Router - send all non-API request to index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Schedule automated tasks
// Check for follow-ups every hour
cron.schedule('0 * * * *', () => {
  console.log('Running scheduled automation checks...');
  automationService.checkAndSendReminders();
});

// Daily digest at 8 AM
cron.schedule('0 8 * * *', () => {
  console.log('Sending daily digest...');
  automationService.sendDailyDigest();
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🎬 NTS Films API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
