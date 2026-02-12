const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
};

  router.post('/register', (req, res) => {
  return res.status(403).json({ error: 'Registration is disabled' });
});
// Register new user (client)
// router.post('/register', validate([
//   body('email').isEmail().normalizeEmail(),
//   body('password').isLength({ min: 6 }),
//   body('name').notEmpty().trim()
// ]), async (req, res) => {
//   try {
//     const { email, password, name, phone } = req.body;

//     // Check if user exists
//     const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
//     if (existingUser) {
//       return res.status(400).json({ error: 'Email already registered' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Create user
//     const userId = uuidv4();
//     db.prepare(`
//       INSERT INTO users (id, email, password, name, phone, role)
//       VALUES (?, ?, ?, ?, ?, 'client')
//     `).run(userId, email, hashedPassword, name, phone || null);

//     // Create client profile
//     db.prepare(`
//       INSERT INTO client_profiles (id, user_id)
//       VALUES (?, ?)
//     `).run(uuidv4(), userId);

//     // Generate token
//     const token = jwt.sign(
//       { userId, email, role: 'client' },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
//     );

//     // Update last login
//     db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);

//     res.status(201).json({
//       message: 'Registration successful',
//       token,
//       user: { id: userId, email, name, role: 'client' }
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ error: 'Registration failed' });
//   }
// });

// Login
router.post('/login', validate([
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
]), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.role, u.avatar, u.created_at,
             cp.company_name, cp.address, cp.city, cp.state, cp.zip, cp.country, cp.notes, cp.tags
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get stats for the user
    let stats = {};
    if (user.role === 'admin') {
      stats = {
        totalLeads: db.prepare('SELECT COUNT(*) as count FROM leads').get().count,
        newLeads: db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get().count,
        activeProjects: db.prepare("SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('completed', 'cancelled')").get().count,
        totalClients: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client'").get().count,
      };
    } else {
      stats = {
        activeProjects: db.prepare("SELECT COUNT(*) as count FROM projects WHERE client_id = ? AND status NOT IN ('completed', 'cancelled')").get(user.id).count,
        completedProjects: db.prepare("SELECT COUNT(*) as count FROM projects WHERE client_id = ? AND status = 'completed'").get(user.id).count,
        pendingInvoices: db.prepare("SELECT COUNT(*) as count FROM invoices WHERE client_id = ? AND status IN ('sent', 'viewed', 'overdue')").get(user.id).count,
      };
    }

    res.json({ user, stats });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.put('/me', authenticateToken, validate([
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
]), async (req, res) => {
  try {
    const { name, phone, company_name, address, city, state, zip, country } = req.body;

    // Update user
    if (name || phone) {
      db.prepare(`
        UPDATE users SET 
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, phone, req.user.id);
    }

    // Update client profile if applicable
    if (req.user.role === 'client') {
      db.prepare(`
        UPDATE client_profiles SET
          company_name = COALESCE(?, company_name),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state = COALESCE(?, state),
          zip = COALESCE(?, zip),
          country = COALESCE(?, country),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(company_name, address, city, state, zip, country, req.user.id);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', authenticateToken, validate([
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
]), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot password (request reset)
router.post('/forgot-password', validate([
  body('email').isEmail().normalizeEmail()
]), async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // In a real app, you would:
    // 1. Generate a reset token
    // 2. Store it with expiration
    // 3. Send email with reset link
    
    // For MVP, just log it
    console.log(`Password reset requested for: ${email}`);
    
    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

// Update user profile
router.put('/profile', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email, phone, req.user.id);

    const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(req.user.id);
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(current_password, user.password);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update notification settings
router.put('/notifications', (req, res) => {
  try {
    const settings = req.body;
    
    // Store notification settings in user preferences (as JSON)
    db.prepare(`
      UPDATE users SET
        notification_settings = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(settings), req.user.id);

    res.json({ message: 'Notification preferences saved', settings });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

module.exports = router;
