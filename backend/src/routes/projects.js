const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

// Get all projects
router.get('/', (req, res) => {
  try {
    const { status, client_id, service_type, search, sort = 'created_at', order = 'desc' } = req.query;
    
    let query = `
      SELECT p.*, u.name as client_name, u.email as client_email
      FROM projects p
      JOIN users u ON p.client_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // If client, only show their projects
    if (req.user.role === 'client') {
      query += ' AND p.client_id = ?';
      params.push(req.user.id);
    } else if (client_id) {
      query += ' AND p.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (service_type) {
      query += ' AND p.service_type = ?';
      params.push(service_type);
    }

    if (search) {
      query += ' AND (p.title LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const validSortColumns = ['created_at', 'title', 'status', 'filming_date', 'delivery_date'];
    const sortColumn = validSortColumns.includes(sort) ? `p.${sort}` : 'p.created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const projects = db.prepare(query).all(...params);

    // Add task progress to each project
    const projectsWithProgress = projects.map(project => {
      const tasks = db.prepare('SELECT completed FROM project_tasks WHERE project_id = ?').all(project.id);
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.completed).length;
      return {
        ...project,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        taskCount: totalTasks,
        completedTaskCount: completedTasks
      };
    });

    // Get status counts
    let statusQuery = 'SELECT status, COUNT(*) as count FROM projects';
    if (req.user.role === 'client') {
      statusQuery += ' WHERE client_id = ?';
    }
    statusQuery += ' GROUP BY status';
    
    const statusCounts = req.user.role === 'client' 
      ? db.prepare(statusQuery).all(req.user.id)
      : db.prepare(statusQuery).all();

    res.json({ projects: projectsWithProgress, statusCounts });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.*, u.name as client_name, u.email as client_email, u.phone as client_phone
      FROM projects p
      JOIN users u ON p.client_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    if (req.user.role === 'client' && project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get tasks
    const tasks = db.prepare(`
      SELECT * FROM project_tasks WHERE project_id = ? ORDER BY order_index ASC
    `).all(req.params.id);

    // Get calendar events
    const events = db.prepare(`
      SELECT * FROM calendar_events WHERE project_id = ? ORDER BY start_datetime ASC
    `).all(req.params.id);

    // Get invoices
    const invoices = db.prepare(`
      SELECT id, invoice_number, total, status, due_date FROM invoices WHERE project_id = ?
    `).all(req.params.id);

    // Get uploads
    const uploads = db.prepare(`
      SELECT * FROM uploads WHERE project_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    // Get questionnaire responses
    const responses = db.prepare(`
      SELECT qr.*, q.title as questionnaire_title
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.project_id = ?
    `).all(req.params.id);

    res.json({ 
      project, 
      tasks, 
      events, 
      invoices, 
      uploads,
      questionnaireResponses: responses
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project (admin only)
router.post('/', [
  body('title').notEmpty().trim(),
  body('client_id').notEmpty(),
  body('service_type').notEmpty()
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      client_id, title, description, service_type, status = 'inquiry',
      priority, start_date, end_date, filming_date, filming_location,
      delivery_date, budget, notes 
    } = req.body;

    // Verify client exists
    const client = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(client_id, 'client');
    if (!client) {
      return res.status(400).json({ error: 'Client not found' });
    }

    const projectId = uuidv4();
    
    db.prepare(`
      INSERT INTO projects (
        id, client_id, title, description, service_type, status, priority,
        start_date, end_date, filming_date, filming_location, delivery_date, budget, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, client_id, title, description || null, service_type, status,
      priority || 'normal', start_date || null, end_date || null,
      filming_date || null, filming_location || null, delivery_date || null,
      budget || null, notes || null
    );

    // Create tasks based on service type
    let defaultTasks;
    
    if (service_type === 'wedding') {
      // Wedding-specific milestones
      defaultTasks = [
        { title: 'Initial Consultation', order: 0 },
        { title: 'Send Quote/Proposal', order: 1 },
        { title: 'Paid Travel Fee Deposit', order: 2 },
        { title: 'Wedding is in Calendar', order: 3 },
        { title: 'Week Before Reminder Text Sent', order: 4 },
        { title: 'Wedding Filmed', order: 5 },
        { title: 'Wedding is Backed Up on Drive', order: 6 },
        { title: 'Asked for Wedding Songs', order: 7 },
        { title: 'Full Amount Has Been Paid', order: 8 },
        { title: 'Wedding Video is Finished', order: 9 },
        { title: 'Video is Uploaded to YouTube', order: 10 },
        { title: 'YouTube Link is Shared with Client', order: 11 },
        { title: 'WeTransfer Link is Sent', order: 12 },
        { title: 'Website is Updated with Their Video', order: 13 },
        { title: 'Video is on Instagram', order: 14 }
      ];
    } else {
      // Standard milestones for other service types
      defaultTasks = [
        { title: 'Initial Consultation', order: 0 },
        { title: 'Send Quote/Proposal', order: 1 },
        { title: 'Contract Signing', order: 2 },
        { title: 'Deposit Received', order: 3 },
        { title: 'Pre-production Planning', order: 4 },
        { title: 'Filming Day', order: 5 },
        { title: 'Footage Backed Up', order: 6 },
        { title: 'Editing & Post-production', order: 7 },
        { title: 'Client Review', order: 8 },
        { title: 'Revisions Complete', order: 9 },
        { title: 'Final Payment Received', order: 10 },
        { title: 'Final Delivery', order: 11 },
        { title: 'Files Uploaded/Shared', order: 12 }
      ];
    }

    for (const task of defaultTasks) {
      db.prepare(`
        INSERT INTO project_tasks (id, project_id, title, order_index)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), projectId, task.title, task.order);
    }

    // Auto-create calendar event for filming date
    if (filming_date) {
      const filmingEventId = uuidv4();
      const eventTitle = service_type === 'wedding' 
        ? `${client.name} Wedding` 
        : `${title} - Filming`;
      
      db.prepare(`
        INSERT INTO calendar_events (
          id, project_id, client_id, title, event_type,
          start_datetime, end_datetime, location, all_day
        )
        VALUES (?, ?, ?, ?, 'filming', ?, ?, ?, 1)
      `).run(
        filmingEventId,
        projectId,
        client_id,
        eventTitle,
        `${filming_date}T09:00:00`,
        `${filming_date}T18:00:00`,
        filming_location || null
      );
    }

    // Auto-create calendar event for delivery date
    if (delivery_date) {
      const deliveryEventId = uuidv4();
      db.prepare(`
        INSERT INTO calendar_events (
          id, project_id, client_id, title, event_type,
          start_datetime, end_datetime, all_day
        )
        VALUES (?, ?, ?, ?, 'delivery', ?, ?, 1)
      `).run(
        deliveryEventId,
        projectId,
        client_id,
        `${title} - Delivery Due`,
        `${delivery_date}T09:00:00`,
        `${delivery_date}T17:00:00`
      );
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    // Create notification for client
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), 
      client_id, 
      'project_created', 
      'New Project Created',
      `Your project "${title}" has been created`,
      `/projects/${projectId}`
    );

    res.status(201).json({ message: 'Project created successfully', project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    if (req.user.role === 'client' && project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Clients can only update certain fields
    const adminOnlyFields = ['status', 'budget', 'final_price', 'deposit_amount', 'deposit_paid'];
    
    const { 
      title, description, service_type, status, priority,
      start_date, end_date, filming_date, filming_location,
      delivery_date, budget, final_price, deposit_amount, deposit_paid, notes 
    } = req.body;

    // Build update based on role
    if (req.user.role === 'admin') {
      db.prepare(`
        UPDATE projects SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          service_type = COALESCE(?, service_type),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          filming_date = COALESCE(?, filming_date),
          filming_location = COALESCE(?, filming_location),
          delivery_date = COALESCE(?, delivery_date),
          budget = COALESCE(?, budget),
          final_price = COALESCE(?, final_price),
          deposit_amount = COALESCE(?, deposit_amount),
          deposit_paid = COALESCE(?, deposit_paid),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        title, description, service_type, status, priority,
        start_date, end_date, filming_date, filming_location,
        delivery_date, budget, final_price, deposit_amount, deposit_paid, notes,
        req.params.id
      );

      // Sync calendar events if dates changed
      if (filming_date && filming_date !== project.filming_date) {
        // Check if filming event exists
        const existingFilmingEvent = db.prepare(`
          SELECT id FROM calendar_events WHERE project_id = ? AND event_type = 'filming'
        `).get(req.params.id);
        
        if (existingFilmingEvent) {
          // Update existing event
          db.prepare(`
            UPDATE calendar_events SET
              start_datetime = ?,
              end_datetime = ?,
              location = COALESCE(?, location),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            `${filming_date}T09:00:00`,
            `${filming_date}T18:00:00`,
            filming_location,
            existingFilmingEvent.id
          );
        } else {
          // Create new filming event
          const client = db.prepare('SELECT name FROM users WHERE id = ?').get(project.client_id);
          db.prepare(`
            INSERT INTO calendar_events (
              id, project_id, client_id, title, event_type,
              start_datetime, end_datetime, location, all_day
            )
            VALUES (?, ?, ?, ?, 'filming', ?, ?, ?, 1)
          `).run(
            uuidv4(),
            req.params.id,
            project.client_id,
            project.service_type === 'wedding' ? `${client?.name} Wedding` : `${project.title} - Filming`,
            `${filming_date}T09:00:00`,
            `${filming_date}T18:00:00`,
            filming_location || null
          );
        }
      }

      if (delivery_date && delivery_date !== project.delivery_date) {
        // Check if delivery event exists
        const existingDeliveryEvent = db.prepare(`
          SELECT id FROM calendar_events WHERE project_id = ? AND event_type = 'delivery'
        `).get(req.params.id);
        
        if (existingDeliveryEvent) {
          // Update existing event
          db.prepare(`
            UPDATE calendar_events SET
              start_datetime = ?,
              end_datetime = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            `${delivery_date}T09:00:00`,
            `${delivery_date}T17:00:00`,
            existingDeliveryEvent.id
          );
        } else {
          // Create new delivery event
          db.prepare(`
            INSERT INTO calendar_events (
              id, project_id, client_id, title, event_type,
              start_datetime, end_datetime, all_day
            )
            VALUES (?, ?, ?, ?, 'delivery', ?, ?, 1)
          `).run(
            uuidv4(),
            req.params.id,
            project.client_id,
            `${project.title} - Delivery Due`,
            `${delivery_date}T09:00:00`,
            `${delivery_date}T17:00:00`
          );
        }
      }

      // If status changed, notify client
      if (status && status !== project.status) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          project.client_id,
          'project_status_changed',
          'Project Status Updated',
          `Your project "${project.title}" status changed to ${status.replace(/_/g, ' ')}`,
          `/projects/${req.params.id}`
        );
      }
    } else {
      // Client can only update notes
      db.prepare(`
        UPDATE projects SET
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(notes, req.params.id);
    }

    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ message: 'Project updated successfully', project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Update project task
router.put('/:id/tasks/:taskId', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?')
      .get(req.params.taskId, req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only admin can update tasks
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, description, due_date, completed } = req.body;

    db.prepare(`
      UPDATE project_tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = COALESCE(?, due_date),
        completed = COALESCE(?, completed),
        completed_at = CASE WHEN ? = 1 AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `).run(title, description, due_date, completed, completed, req.params.taskId);

    const updatedTask = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(req.params.taskId);
    res.json({ message: 'Task updated successfully', task: updatedTask });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Add task to project
router.post('/:id/tasks', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { title, description, due_date } = req.body;

    // Get max order index
    const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM project_tasks WHERE project_id = ?')
      .get(req.params.id);

    const taskId = uuidv4();
    db.prepare(`
      INSERT INTO project_tasks (id, project_id, title, description, due_date, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, req.params.id, title, description || null, due_date || null, (maxOrder.max || 0) + 1);

    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    res.status(201).json({ message: 'Task created successfully', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Delete project (admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete project (tasks cascade)
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
