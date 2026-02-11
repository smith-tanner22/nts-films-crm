const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const bcrypt = require('bcryptjs');

// Get all clients (admin only)
router.get('/', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { search, sort = 'created_at', order = 'desc' } = req.query;
    
    let query = `
      SELECT u.id, u.email, u.name, u.phone, u.created_at, u.last_login, u.is_active,
             cp.company_name, cp.city, cp.state, cp.tags as services, cp.notes,
             CASE WHEN cp.city IS NOT NULL AND cp.state IS NOT NULL 
                  THEN cp.city || ', ' || cp.state 
                  ELSE COALESCE(cp.city, cp.state, '') END as location,
             (SELECT COUNT(*) FROM projects WHERE client_id = u.id) as project_count,
             (SELECT COUNT(*) FROM projects WHERE client_id = u.id AND status NOT IN ('completed', 'cancelled')) as active_projects,
             (SELECT SUM(total) FROM invoices WHERE client_id = u.id AND status = 'paid') as total_revenue
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.role = 'client'
    `;
    const params = [];

    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR cp.company_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const validSortColumns = ['created_at', 'name', 'email', 'last_login'];
    const sortColumn = validSortColumns.includes(sort) ? `u.${sort}` : 'u.created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const clients = db.prepare(query).all(...params);

    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client
router.get('/:id', (req, res) => {
  try {
    // Clients can only view their own profile
    if (req.user.role === 'client' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.created_at, u.last_login, u.avatar,
             cp.company_name, cp.notes, cp.tags as services,
             CASE WHEN cp.city IS NOT NULL AND cp.state IS NOT NULL 
                  THEN cp.city || ', ' || cp.state 
                  ELSE COALESCE(cp.city, cp.state, '') END as location
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.id = ? AND u.role = 'client'
    `).get(req.params.id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get client's projects
    const projects = db.prepare(`
      SELECT id, title, service_type, status, start_date, end_date, filming_date
      FROM projects
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    // Get client's invoices
    const invoices = db.prepare(`
      SELECT id, invoice_number, total, status, due_date, created_at
      FROM invoices
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    // Get questionnaire responses
    const responses = db.prepare(`
      SELECT qr.id, qr.submitted_at, q.title as questionnaire_title, qr.project_id
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.client_id = ?
      ORDER BY qr.submitted_at DESC
    `).all(req.params.id);

    res.json({ client, projects, invoices, questionnaireResponses: responses });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client (admin only)
router.post('/', [
  body('name').notEmpty().trim(),
], async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, phone, company_name, location, services, notes, sendInvite } = req.body;

    // Parse location into city/state
    let city = null;
    let state = null;
    if (location) {
      const parts = location.split(',').map(s => s.trim());
      city = parts[0] || null;
      state = parts[1] || null;
    }

    // If no email provided, generate a placeholder
    const clientEmail = email || `${name.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`;

    // Check if email exists (only if real email provided)
    if (email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Create temporary password
    const tempPassword = uuidv4().substring(0, 8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const clientId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, email, password, name, phone, role)
      VALUES (?, ?, ?, ?, ?, 'client')
    `).run(clientId, clientEmail, hashedPassword, name, phone || null);

    db.prepare(`
      INSERT INTO client_profiles (id, user_id, company_name, city, state, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), clientId, company_name || null, city, state, notes || null, services || null);

    // TODO: If sendInvite is true, send email with login credentials

    const client = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.created_at,
             cp.company_name, cp.city, cp.state, cp.tags as services
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.id = ?
    `).get(clientId);

    res.status(201).json({ 
      message: 'Client created successfully',
      client,
      temporaryPassword: sendInvite ? undefined : tempPassword
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', (req, res) => {
  try {
    // Clients can only update their own profile
    if (req.user.role === 'client' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.id, 'client');
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { name, email, phone, company_name, location, services, notes, is_active } = req.body;

    // Parse location into city/state
    let city = null;
    let state = null;
    if (location) {
      const parts = location.split(',').map(s => s.trim());
      city = parts[0] || null;
      state = parts[1] || null;
    }

    // Update user table
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email || undefined, phone, is_active, req.params.id);

    // Update client profile
    db.prepare(`
      UPDATE client_profiles SET
        company_name = COALESCE(?, company_name),
        city = ?,
        state = ?,
        notes = COALESCE(?, notes),
        tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(company_name, city, state, notes, services, req.params.id);

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client (admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const client = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(req.params.id, 'client');
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check for active projects
    const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE client_id = ? AND status NOT IN ('completed', 'cancelled')").get(req.params.id);
    
    if (activeProjects.count > 0) {
      return res.status(400).json({ error: 'Cannot delete client with active projects. Please complete or cancel their projects first.' });
    }

    // Delete related records first (cascade manually)
    const deleteTransaction = db.transaction(() => {
      // Delete project tasks for this client's projects
      db.prepare(`
        DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)
      `).run(req.params.id);
      
      // Delete uploads for this client's projects
      db.prepare(`
        DELETE FROM uploads WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)
      `).run(req.params.id);
      
      // Delete invoices for this client
      db.prepare('DELETE FROM invoices WHERE client_id = ?').run(req.params.id);
      
      // Delete questionnaire responses for this client
      db.prepare('DELETE FROM questionnaire_responses WHERE client_id = ?').run(req.params.id);
      
      // Delete calendar events for this client
      db.prepare('DELETE FROM calendar_events WHERE client_id = ?').run(req.params.id);
      
      // Delete notifications for this user
      db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.params.id);
      
      // Delete projects for this client
      db.prepare('DELETE FROM projects WHERE client_id = ?').run(req.params.id);
      
      // Delete client profile
      db.prepare('DELETE FROM client_profiles WHERE user_id = ?').run(req.params.id);
      
      // Delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    });

    deleteTransaction();

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
