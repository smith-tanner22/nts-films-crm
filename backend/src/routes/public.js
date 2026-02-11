const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

// Public lead inquiry form submission
router.post('/inquiry', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, phone, service_type, event_date, budget, message } = req.body;
    
    const leadId = uuidv4();
    
    db.prepare(`
      INSERT INTO leads (id, name, email, phone, service_type, event_date, budget, message, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'website')
    `).run(leadId, name, email, phone || null, service_type || null, event_date || null, budget || null, message || null);

    // Notify admin
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        admin.id,
        'new_lead',
        'New Lead Inquiry',
        `${name} submitted an inquiry for ${service_type || 'services'}`,
        `/leads`
      );
    }

    // Log automation event for follow-up
    db.prepare(`
      INSERT INTO automation_logs (id, type, target_type, target_id, action, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'lead_followup',
      'lead',
      leadId,
      'send_followup_email',
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    );

    res.status(201).json({ 
      message: 'Thank you for your inquiry! We will get back to you shortly.',
      leadId 
    });
  } catch (error) {
    console.error('Inquiry submission error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// Get questionnaire by access token (public)
router.get('/questionnaire/:token', (req, res) => {
  try {
    const response = db.prepare(`
      SELECT qr.*, q.title, q.description, q.questions,
             l.name as lead_name, u.name as client_name
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      LEFT JOIN leads l ON qr.lead_id = l.id
      LEFT JOIN users u ON qr.client_id = u.id
      WHERE qr.access_token = ?
    `).get(req.params.token);
    
    if (!response) {
      return res.status(404).json({ error: 'Questionnaire not found or link expired' });
    }

    // Check if already submitted
    const existingResponses = JSON.parse(response.responses);
    if (Object.keys(existingResponses).length > 0 && response.submitted_at) {
      return res.status(400).json({ 
        error: 'This questionnaire has already been submitted',
        submitted_at: response.submitted_at
      });
    }

    response.questions = JSON.parse(response.questions);

    res.json({ 
      questionnaire: {
        id: response.questionnaire_id,
        title: response.title,
        description: response.description,
        questions: response.questions
      },
      respondent_name: response.lead_name || response.client_name || 'Guest',
      response_id: response.id
    });
  } catch (error) {
    console.error('Get public questionnaire error:', error);
    res.status(500).json({ error: 'Failed to fetch questionnaire' });
  }
});

// Submit questionnaire response (public)
router.post('/questionnaire/:token', [
  body('responses').isObject()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const responseRecord = db.prepare(`
      SELECT qr.*, q.title, q.questions
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.access_token = ?
    `).get(req.params.token);
    
    if (!responseRecord) {
      return res.status(404).json({ error: 'Questionnaire not found or link expired' });
    }

    // Check if already submitted
    const existingResponses = JSON.parse(responseRecord.responses);
    if (Object.keys(existingResponses).length > 0) {
      return res.status(400).json({ error: 'This questionnaire has already been submitted' });
    }

    const { responses } = req.body;

    // Validate required questions
    const questions = JSON.parse(responseRecord.questions);
    const requiredQuestions = questions.filter(q => q.required);
    
    for (const q of requiredQuestions) {
      if (!responses[q.id] || (Array.isArray(responses[q.id]) && responses[q.id].length === 0)) {
        return res.status(400).json({ error: `Please answer: ${q.question}` });
      }
    }

    // Save responses
    db.prepare(`
      UPDATE questionnaire_responses SET
        responses = ?,
        submitted_at = CURRENT_TIMESTAMP
      WHERE access_token = ?
    `).run(JSON.stringify(responses), req.params.token);

    // Notify admin
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        admin.id,
        'questionnaire_submitted',
        'Questionnaire Submitted',
        `Response received for "${responseRecord.title}"`,
        `/questionnaires/responses/${responseRecord.id}`
      );
    }

    // If linked to a lead, update lead status
    if (responseRecord.lead_id) {
      const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(responseRecord.lead_id);
      if (lead && lead.status === 'new') {
        db.prepare("UPDATE leads SET status = 'qualified', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(responseRecord.lead_id);
      }
    }

    res.json({ message: 'Thank you for completing the questionnaire!' });
  } catch (error) {
    console.error('Submit questionnaire error:', error);
    res.status(500).json({ error: 'Failed to submit questionnaire' });
  }
});

// Public service types (for inquiry form dropdown)
router.get('/services', (req, res) => {
  const services = [
    { id: 'wedding', name: 'Wedding Videography', description: 'Capture your special day' },
    { id: 'corporate', name: 'Corporate Video', description: 'Professional business videos' },
    { id: 'event', name: 'Event Coverage', description: 'Conferences, galas, and more' },
    { id: 'music_video', name: 'Music Video', description: 'Creative music video production' },
    { id: 'commercial', name: 'Commercial', description: 'Advertisement and promotional videos' },
    { id: 'documentary', name: 'Documentary', description: 'Tell your story' },
    { id: 'real_estate', name: 'Real Estate', description: 'Property tours and showcases' },
    { id: 'other', name: 'Other', description: 'Custom video projects' }
  ];
  res.json({ services });
});

module.exports = router;
