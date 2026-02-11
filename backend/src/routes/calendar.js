const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

// Get calendar events
router.get('/', (req, res) => {
  try {
    const { start, end, type, project_id } = req.query;
    
    let query = `
      SELECT ce.*, 
             p.title as project_title, 
             u.name as client_name,
             DATE(ce.start_datetime) as start_date,
             TIME(ce.start_datetime) as start_time,
             DATE(ce.end_datetime) as end_date,
             TIME(ce.end_datetime) as end_time
      FROM calendar_events ce
      LEFT JOIN projects p ON ce.project_id = p.id
      LEFT JOIN users u ON ce.client_id = u.id OR p.client_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by date range
    if (start) {
      query += ' AND DATE(ce.start_datetime) >= ?';
      params.push(start);
    }
    if (end) {
      query += ' AND DATE(ce.start_datetime) <= ?';
      params.push(end);
    }

    if (type) {
      query += ' AND ce.event_type = ?';
      params.push(type);
    }

    if (project_id) {
      query += ' AND ce.project_id = ?';
      params.push(project_id);
    }

    // Clients only see events related to their projects or available slots
    if (req.user.role === 'client') {
      query += ' AND (p.client_id = ? OR ce.client_id = ? OR ce.is_available_slot = 1)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY ce.start_datetime ASC';

    const events = db.prepare(query).all(...params);

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get available slots for booking
router.get('/available-slots', (req, res) => {
  try {
    const { start, end, duration = 120 } = req.query; // duration in minutes

    const slots = db.prepare(`
      SELECT * FROM calendar_events
      WHERE is_available_slot = 1 AND is_booked = 0
      AND start_datetime >= ? AND end_datetime <= ?
      ORDER BY start_datetime ASC
    `).all(start || new Date().toISOString(), end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    res.json({ slots });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// Create event (admin only for most, clients can book available slots)
router.post('/', (req, res) => {
  try {
    const { 
      project_id, client_id, title, description, event_type = 'filming',
      start_datetime, end_datetime, 
      start_date, start_time, end_date, end_time, // Alternative format from frontend
      location, is_available_slot = false, all_day = false,
      color
    } = req.body;

    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Clients can only create by booking existing slots
    if (req.user.role === 'client' && !req.body.slot_id) {
      return res.status(403).json({ error: 'Clients can only book available slots' });
    }

    // Build datetime from either format
    let startDT, endDT;
    if (start_datetime) {
      startDT = start_datetime;
      endDT = end_datetime;
    } else if (start_date) {
      startDT = `${start_date}T${start_time || '09:00'}:00`;
      endDT = `${end_date || start_date}T${end_time || '17:00'}:00`;
    } else {
      return res.status(400).json({ error: 'Start date/time is required' });
    }

    // Check for conflicts (except for available slots)
    if (!is_available_slot) {
      const conflict = db.prepare(`
        SELECT id FROM calendar_events
        WHERE is_available_slot = 0
        AND ((start_datetime <= ? AND end_datetime > ?)
             OR (start_datetime < ? AND end_datetime >= ?)
             OR (start_datetime >= ? AND end_datetime <= ?))
      `).get(startDT, startDT, endDT, endDT, startDT, endDT);

      if (conflict) {
        return res.status(400).json({ error: 'Time slot conflicts with existing event' });
      }
    }

    const eventId = uuidv4();
    
    db.prepare(`
      INSERT INTO calendar_events (
        id, project_id, client_id, title, description, event_type,
        start_datetime, end_datetime, location, is_available_slot, all_day, color
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId, project_id || null, client_id || null, title, description || null, event_type,
      startDT, endDT, location || null, is_available_slot ? 1 : 0, all_day ? 1 : 0,
      color || null
    );

    const event = db.prepare(`
      SELECT ce.*, 
             DATE(ce.start_datetime) as start_date,
             TIME(ce.start_datetime) as start_time,
             DATE(ce.end_datetime) as end_date,
             TIME(ce.end_datetime) as end_time
      FROM calendar_events ce WHERE id = ?
    `).get(eventId);

    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Book an available slot (clients)
router.post('/book/:slotId', (req, res) => {
  try {
    const slot = db.prepare('SELECT * FROM calendar_events WHERE id = ? AND is_available_slot = 1')
      .get(req.params.slotId);
    
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slot.is_booked) {
      return res.status(400).json({ error: 'Slot is already booked' });
    }

    const { project_id } = req.body;

    // If client, verify they own the project
    if (req.user.role === 'client') {
      if (project_id) {
        const project = db.prepare('SELECT id FROM projects WHERE id = ? AND client_id = ?')
          .get(project_id, req.user.id);
        if (!project) {
          return res.status(403).json({ error: 'Invalid project' });
        }
      }
    }

    // Book the slot
    db.prepare(`
      UPDATE calendar_events SET
        is_booked = 1,
        booked_by = ?,
        project_id = COALESCE(?, project_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, project_id, req.params.slotId);

    // Notify admin
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        admin.id,
        'slot_booked',
        'Time Slot Booked',
        `${req.user.name} booked a time slot for ${new Date(slot.start_datetime).toLocaleString()}`,
        `/calendar`
      );
    }

    const updatedSlot = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.slotId);
    res.json({ message: 'Slot booked successfully', event: updatedSlot });
  } catch (error) {
    console.error('Book slot error:', error);
    res.status(500).json({ error: 'Failed to book slot' });
  }
});

// Generate available slots (admin only)
router.post('/generate-slots', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { 
      start_date, end_date, 
      start_time = '09:00', end_time = '17:00',
      slot_duration = 120, // minutes
      exclude_weekends = true,
      exclude_dates = []
    } = req.body;

    const slots = [];
    let currentDate = new Date(start_date);
    const endDate = new Date(end_date);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      // Skip weekends if excluded
      if (exclude_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Skip excluded dates
      if (exclude_dates.includes(dateStr)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Generate slots for this day
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      
      let slotStart = new Date(currentDate);
      slotStart.setHours(startHour, startMin, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(endHour, endMin, 0, 0);

      while (slotStart < dayEnd) {
        const slotEnd = new Date(slotStart.getTime() + slot_duration * 60000);
        
        if (slotEnd <= dayEnd) {
          // Check for existing events
          const conflict = db.prepare(`
            SELECT id FROM calendar_events
            WHERE start_datetime < ? AND end_datetime > ?
          `).get(slotEnd.toISOString(), slotStart.toISOString());

          if (!conflict) {
            const slotId = uuidv4();
            db.prepare(`
              INSERT INTO calendar_events (
                id, title, event_type, start_datetime, end_datetime, is_available_slot
              )
              VALUES (?, ?, ?, ?, ?, 1)
            `).run(
              slotId,
              'Available for Booking',
              'filming',
              slotStart.toISOString(),
              slotEnd.toISOString()
            );
            slots.push({ id: slotId, start: slotStart.toISOString(), end: slotEnd.toISOString() });
          }
        }
        
        slotStart = slotEnd;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({ message: `Generated ${slots.length} available slots`, slots });
  } catch (error) {
    console.error('Generate slots error:', error);
    res.status(500).json({ error: 'Failed to generate slots' });
  }
});

// Update event
router.put('/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Only admin can update events
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      title, description, event_type, 
      start_datetime, end_datetime,
      start_date, start_time, end_date, end_time, // Alternative format
      location, color, is_available_slot, all_day, client_id, project_id
    } = req.body;

    // Build datetime from either format
    let startDT = start_datetime;
    let endDT = end_datetime;
    if (!startDT && start_date) {
      startDT = `${start_date}T${start_time || '09:00'}:00`;
    }
    if (!endDT && (end_date || start_date)) {
      endDT = `${end_date || start_date}T${end_time || '17:00'}:00`;
    }

    db.prepare(`
      UPDATE calendar_events SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        event_type = COALESCE(?, event_type),
        start_datetime = COALESCE(?, start_datetime),
        end_datetime = COALESCE(?, end_datetime),
        location = COALESCE(?, location),
        color = COALESCE(?, color),
        is_available_slot = COALESCE(?, is_available_slot),
        all_day = COALESCE(?, all_day),
        client_id = COALESCE(?, client_id),
        project_id = COALESCE(?, project_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, event_type, startDT, endDT, location, color, is_available_slot, all_day, client_id, project_id, req.params.id);

    const updated = db.prepare(`
      SELECT ce.*, 
             DATE(ce.start_datetime) as start_date,
             TIME(ce.start_datetime) as start_time,
             DATE(ce.end_datetime) as end_date,
             TIME(ce.end_datetime) as end_time
      FROM calendar_events ce WHERE id = ?
    `).get(req.params.id);
    res.json({ message: 'Event updated successfully', event: updated });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
