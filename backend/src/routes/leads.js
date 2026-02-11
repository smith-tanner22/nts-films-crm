const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const bcrypt = require('bcryptjs');

// Get all leads with filtering and sorting
router.get('/', (req, res) => {
  try {
    const { status, service_type, search, sort = 'created_at', order = 'desc' } = req.query;
    
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (service_type) {
      query += ' AND service_type = ?';
      params.push(service_type);
    }

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Validate sort column to prevent SQL injection
    const validSortColumns = ['created_at', 'name', 'status', 'service_type', 'updated_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const leads = db.prepare(query).all(...params);
    
    // Get lead counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM leads GROUP BY status
    `).all();

    res.json({ leads, statusCounts });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead
router.get('/:id', (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get questionnaire responses for this lead
    const responses = db.prepare(`
      SELECT qr.*, q.title as questionnaire_title
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.lead_id = ?
    `).all(lead.id);

    res.json({ lead, questionnaireResponses: responses });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead
router.post('/', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, phone, service_type, event_date, budget, message, source } = req.body;
    
    const leadId = uuidv4();
    
    db.prepare(`
      INSERT INTO leads (id, name, email, phone, service_type, event_date, budget, message, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(leadId, name, email, phone || null, service_type || null, event_date || null, budget || null, message || null, source || 'admin');

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, 'created', 'lead', leadId, JSON.stringify({ name, email }));

    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
router.put('/:id', (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { name, email, phone, service_type, event_date, budget, message, status, notes } = req.body;

    db.prepare(`
      UPDATE leads SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        service_type = COALESCE(?, service_type),
        event_date = COALESCE(?, event_date),
        budget = COALESCE(?, budget),
        message = COALESCE(?, message),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email, phone, service_type, event_date, budget, message, status, notes, req.params.id);

    const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, 'updated', 'lead', req.params.id, JSON.stringify({ status }));

    res.json({ message: 'Lead updated successfully', lead: updatedLead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Convert lead to client
router.post('/:id/convert', async (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.status === 'converted') {
      return res.status(400).json({ error: 'Lead already converted' });
    }

    // Check if email already exists as a user
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(lead.email);
    
    let clientId;
    
    if (existingUser) {
      clientId = existingUser.id;
    } else {
      // Create new client user
      clientId = uuidv4();
      const tempPassword = await bcrypt.hash(uuidv4().substring(0, 8), 10);
      
      db.prepare(`
        INSERT INTO users (id, email, password, name, phone, role)
        VALUES (?, ?, ?, ?, ?, 'client')
      `).run(clientId, lead.email, tempPassword, lead.name, lead.phone);

      // Create client profile
      db.prepare(`
        INSERT INTO client_profiles (id, user_id, notes)
        VALUES (?, ?, ?)
      `).run(uuidv4(), clientId, `Converted from lead. Original message: ${lead.message || 'N/A'}`);
    }

    // Update lead status
    db.prepare(`
      UPDATE leads SET 
        status = 'converted',
        converted_to_client_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(clientId, lead.id);

    // Transfer questionnaire responses from lead to client
    db.prepare(`
      UPDATE questionnaire_responses SET client_id = ? WHERE lead_id = ?
    `).run(clientId, lead.id);

    // Optionally create initial project
    if (req.body.createProject) {
      const projectId = uuidv4();
      db.prepare(`
        INSERT INTO projects (id, client_id, title, service_type, status, notes)
        VALUES (?, ?, ?, ?, 'inquiry', ?)
      `).run(
        projectId,
        clientId,
        req.body.projectTitle || `${lead.service_type || 'Video'} Project`,
        lead.service_type,
        `Converted from lead inquiry. Budget: ${lead.budget || 'TBD'}`
      );
    }

    const client = db.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').get(clientId);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, 'converted', 'lead', lead.id, JSON.stringify({ clientId }));

    res.json({ 
      message: 'Lead converted to client successfully', 
      client,
      isExistingClient: !!existingUser
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

// Delete lead
router.delete('/:id', (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, 'deleted', 'lead', req.params.id, JSON.stringify({ name: lead.name }));

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
