const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

// Get all questionnaires (admin gets all, clients get responses)
router.get('/', (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const questionnaires = db.prepare(`
        SELECT q.*,
               (SELECT COUNT(*) FROM questionnaire_responses WHERE questionnaire_id = q.id) as response_count
        FROM questionnaires q
        ORDER BY q.created_at DESC
      `).all();

      // Also get all responses for the responses tab
      const responses = db.prepare(`
        SELECT qr.*, 
               q.title as questionnaire_title,
               l.name as lead_name, l.email as lead_email,
               u.name as client_name, u.email as client_email,
               p.title as project_title
        FROM questionnaire_responses qr
        JOIN questionnaires q ON qr.questionnaire_id = q.id
        LEFT JOIN leads l ON qr.lead_id = l.id
        LEFT JOIN users u ON qr.client_id = u.id
        LEFT JOIN projects p ON qr.project_id = p.id
        ORDER BY qr.submitted_at DESC
      `).all();

      res.json({ questionnaires, responses });
    } else {
      // Clients see their responses
      const responses = db.prepare(`
        SELECT qr.*, q.title as questionnaire_title, q.description
        FROM questionnaire_responses qr
        JOIN questionnaires q ON qr.questionnaire_id = q.id
        WHERE qr.client_id = ?
        ORDER BY qr.submitted_at DESC
      `).all(req.user.id);

      res.json({ responses });
    }
  } catch (error) {
    console.error('Get questionnaires error:', error);
    res.status(500).json({ error: 'Failed to fetch questionnaires' });
  }
});

// Get single questionnaire
router.get('/:id', (req, res) => {
  try {
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    // Parse questions
    questionnaire.questions = JSON.parse(questionnaire.questions);

    // Admin gets response stats
    if (req.user.role === 'admin') {
      const responses = db.prepare(`
        SELECT qr.*, 
               l.name as lead_name, l.email as lead_email,
               u.name as client_name, u.email as client_email
        FROM questionnaire_responses qr
        LEFT JOIN leads l ON qr.lead_id = l.id
        LEFT JOIN users u ON qr.client_id = u.id
        WHERE qr.questionnaire_id = ?
        ORDER BY qr.submitted_at DESC
      `).all(req.params.id);

      res.json({ questionnaire, responses });
    } else {
      res.json({ questionnaire });
    }
  } catch (error) {
    console.error('Get questionnaire error:', error);
    res.status(500).json({ error: 'Failed to fetch questionnaire' });
  }
});

// Create questionnaire (admin only)
router.post('/', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    let { title, description, service_type, questions } = req.body;

    console.log('Creating questionnaire with data:', { title, description, service_type, questionsType: typeof questions });

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Parse questions if it's a string
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        console.error('Failed to parse questions JSON:', e);
        return res.status(400).json({ error: 'Invalid questions format' });
      }
    }

    // If questions is still undefined or not an array, create default
    if (!questions || !Array.isArray(questions)) {
      questions = [];
    }

    // Filter out empty questions but keep at least one
    const validQuestions = questions.filter(q => q.question && q.question.trim());
    
    if (validQuestions.length === 0 && questions.length > 0) {
      // If there are questions but all have empty text, use them anyway
      // Just ensure they have the required structure
      questions = questions.map((q, index) => ({
        id: q.id || String(index + 1),
        type: q.type || 'text',
        question: q.question || `Question ${index + 1}`,
        required: q.required || false,
        options: q.options || []
      }));
    } else if (validQuestions.length > 0) {
      questions = validQuestions;
    } else {
      return res.status(400).json({ error: 'At least one question is required' });
    }

    const questionnaireId = uuidv4();
    
    db.prepare(`
      INSERT INTO questionnaires (id, title, description, service_type, questions)
      VALUES (?, ?, ?, ?, ?)
    `).run(questionnaireId, title.trim(), description || null, service_type || null, JSON.stringify(questions));

    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(questionnaireId);
    questionnaire.questions = JSON.parse(questionnaire.questions);

    res.status(201).json({ message: 'Questionnaire created successfully', questionnaire });
  } catch (error) {
    console.error('Create questionnaire error:', error);
    res.status(500).json({ error: 'Failed to create questionnaire' });
  }
});

// Update questionnaire (admin only)
router.put('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    const { title, description, service_type, questions, is_active } = req.body;

    db.prepare(`
      UPDATE questionnaires SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        service_type = COALESCE(?, service_type),
        questions = COALESCE(?, questions),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, 
      description, 
      service_type, 
      questions ? JSON.stringify(questions) : null,
      is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    updated.questions = JSON.parse(updated.questions);

    res.json({ message: 'Questionnaire updated successfully', questionnaire: updated });
  } catch (error) {
    console.error('Update questionnaire error:', error);
    res.status(500).json({ error: 'Failed to update questionnaire' });
  }
});

// Generate shareable link for questionnaire
router.post('/:id/link', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    const { lead_id, client_id, project_id } = req.body;

    // Create a response placeholder with access token
    const responseId = uuidv4();
    const accessToken = uuidv4();

    db.prepare(`
      INSERT INTO questionnaire_responses (id, questionnaire_id, lead_id, client_id, project_id, responses, access_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      responseId,
      req.params.id,
      lead_id || null,
      client_id || null,
      project_id || null,
      '{}', // Empty responses initially
      accessToken
    );

    const shareableLink = `${process.env.FRONTEND_URL}/questionnaire/${accessToken}`;

    res.json({ 
      message: 'Link generated successfully',
      link: shareableLink,
      accessToken,
      responseId
    });
  } catch (error) {
    console.error('Generate link error:', error);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// Get all responses for a questionnaire (admin only)
router.get('/:id/responses', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    const responses = db.prepare(`
      SELECT qr.*, 
             l.name as lead_name, l.email as lead_email,
             u.name as client_name, u.email as client_email,
             p.title as project_title
      FROM questionnaire_responses qr
      LEFT JOIN leads l ON qr.lead_id = l.id
      LEFT JOIN users u ON qr.client_id = u.id
      LEFT JOIN projects p ON qr.project_id = p.id
      WHERE qr.questionnaire_id = ? AND qr.responses != '{}'
      ORDER BY qr.submitted_at DESC
    `).all(req.params.id);

    res.json({ responses });
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Get response by ID
router.get('/responses/:id', (req, res) => {
  try {
    const response = db.prepare(`
      SELECT qr.*, q.title as questionnaire_title, q.questions,
             l.name as lead_name, l.email as lead_email,
             u.name as client_name, u.email as client_email,
             p.title as project_title
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      LEFT JOIN leads l ON qr.lead_id = l.id
      LEFT JOIN users u ON qr.client_id = u.id
      LEFT JOIN projects p ON qr.project_id = p.id
      WHERE qr.id = ?
    `).get(req.params.id);
    
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Check access
    if (req.user.role === 'client' && response.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    response.questions = JSON.parse(response.questions);
    response.responses = JSON.parse(response.responses);

    res.json({ response });
  } catch (error) {
    console.error('Get response error:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

// Delete questionnaire (admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    // Check for responses
    const responseCount = db.prepare('SELECT COUNT(*) as count FROM questionnaire_responses WHERE questionnaire_id = ?')
      .get(req.params.id).count;

    if (responseCount > 0 && !req.query.force) {
      return res.status(400).json({ 
        error: 'Questionnaire has responses. Add ?force=true to delete anyway.',
        responseCount 
      });
    }

    db.prepare('DELETE FROM questionnaire_responses WHERE questionnaire_id = ?').run(req.params.id);
    db.prepare('DELETE FROM questionnaires WHERE id = ?').run(req.params.id);

    res.json({ message: 'Questionnaire deleted successfully' });
  } catch (error) {
    console.error('Delete questionnaire error:', error);
    res.status(500).json({ error: 'Failed to delete questionnaire' });
  }
});

module.exports = router;
