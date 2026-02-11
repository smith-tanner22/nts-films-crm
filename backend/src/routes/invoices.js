const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

// Generate invoice number
const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const lastInvoice = db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE 'INV-${year}-%'
    ORDER BY invoice_number DESC LIMIT 1
  `).get();

  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.invoice_number.split('-')[2]);
    return `INV-${year}-${String(lastNum + 1).padStart(3, '0')}`;
  }
  return `INV-${year}-001`;
};

// Get all invoices
router.get('/', (req, res) => {
  try {
    const { status, client_id, sort = 'created_at', order = 'desc' } = req.query;
    
    let query = `
      SELECT i.*, u.name as client_name, u.email as client_email, p.title as project_title
      FROM invoices i
      JOIN users u ON i.client_id = u.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    // Clients only see their invoices
    if (req.user.role === 'client') {
      query += ' AND i.client_id = ?';
      params.push(req.user.id);
    } else if (client_id) {
      query += ' AND i.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    const validSortColumns = ['created_at', 'invoice_number', 'total', 'status', 'due_date'];
    const sortColumn = validSortColumns.includes(sort) ? `i.${sort}` : 'i.created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const invoices = db.prepare(query).all(...params);

    // Parse items for each invoice
    invoices.forEach(inv => {
      inv.items = JSON.parse(inv.items);
    });

    // Get status summary
    let summaryQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status IN ('sent', 'viewed', 'overdue') THEN total ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
      FROM invoices
    `;
    if (req.user.role === 'client') {
      summaryQuery += ' WHERE client_id = ?';
    }
    
    const summary = req.user.role === 'client'
      ? db.prepare(summaryQuery).get(req.user.id)
      : db.prepare(summaryQuery).get();

    res.json({ invoices, summary });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, u.name as client_name, u.email as client_email, u.phone as client_phone,
             cp.company_name, cp.address, cp.city, cp.state, cp.zip, cp.country,
             p.title as project_title
      FROM invoices i
      JOIN users u ON i.client_id = u.id
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `).get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check access
    if (req.user.role === 'client' && invoice.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    invoice.items = JSON.parse(invoice.items);

    // If client is viewing, mark as viewed
    if (req.user.role === 'client' && invoice.status === 'sent') {
      db.prepare("UPDATE invoices SET status = 'viewed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.params.id);
      invoice.status = 'viewed';
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice (admin only)
router.post('/', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    let { client_id, project_id, items, subtotal, tax_rate = 0, tax_amount = 0, discount = 0, total, due_date, notes, status = 'draft' } = req.body;

    console.log('Creating invoice with data:', { client_id, project_id, itemsType: typeof items, due_date });

    if (!client_id) {
      return res.status(400).json({ error: 'Client is required' });
    }

    // Parse items if it's a string
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        console.error('Failed to parse items JSON:', e);
        return res.status(400).json({ error: 'Invalid items format' });
      }
    }

    // If items is still undefined or not an array, default to empty array
    if (!items || !Array.isArray(items)) {
      items = [];
    }

    // Filter out items without descriptions but ensure we have at least one
    const validItems = items.filter(item => item.description && item.description.trim());
    
    if (validItems.length === 0) {
      // If all items have empty descriptions, create a default line item
      if (items.length > 0) {
        items = items.map((item, index) => ({
          description: item.description || `Line item ${index + 1}`,
          quantity: parseFloat(item.quantity) || 1,
          rate: parseFloat(item.rate) || 0,
          amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0)
        }));
      } else {
        return res.status(400).json({ error: 'At least one line item is required' });
      }
    } else {
      items = validItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0)
      }));
    }

    // Verify client
    const client = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(client_id, 'client');
    if (!client) {
      return res.status(400).json({ error: 'Client not found' });
    }

    // Calculate totals
    subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    tax_amount = subtotal * (parseFloat(tax_rate) / 100);
    total = subtotal + tax_amount - (parseFloat(discount) || 0);

    const invoiceId = uuidv4();
    const invoiceNumber = generateInvoiceNumber();
    
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, client_id, project_id, items, subtotal,
        tax_rate, tax_amount, discount, total, status, due_date, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId, invoiceNumber, client_id, project_id || null,
      JSON.stringify(items), subtotal, tax_rate, tax_amount, discount, total,
      status, due_date || null, notes || null
    );

    // Create notification for client
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      client_id,
      'invoice_created',
      'New Invoice',
      `Invoice ${invoiceNumber} has been created for $${total.toFixed(2)}`,
      `/invoices/${invoiceId}`
    );

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    invoice.items = JSON.parse(invoice.items);

    res.status(201).json({ message: 'Invoice created successfully', invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice (admin only)
router.put('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { items, tax_rate, discount, due_date, notes, status, paid_date, payment_method } = req.body;

    // Recalculate if items changed
    let subtotal = invoice.subtotal;
    let tax_amount = invoice.tax_amount;
    let total = invoice.total;

    if (items) {
      subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const newTaxRate = tax_rate !== undefined ? tax_rate : invoice.tax_rate;
      const newDiscount = discount !== undefined ? discount : invoice.discount;
      tax_amount = subtotal * (newTaxRate / 100);
      total = subtotal + tax_amount - newDiscount;
    }

    db.prepare(`
      UPDATE invoices SET
        items = COALESCE(?, items),
        subtotal = ?,
        tax_rate = COALESCE(?, tax_rate),
        tax_amount = ?,
        discount = COALESCE(?, discount),
        total = ?,
        due_date = COALESCE(?, due_date),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        paid_date = COALESCE(?, paid_date),
        payment_method = COALESCE(?, payment_method),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      items ? JSON.stringify(items) : null,
      subtotal,
      tax_rate,
      tax_amount,
      discount,
      total,
      due_date,
      notes,
      status,
      paid_date,
      payment_method,
      req.params.id
    );

    // If marked as paid, notify admin and update project if linked
    if (status === 'paid' && invoice.status !== 'paid') {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        invoice.client_id,
        'invoice_paid',
        'Payment Received',
        `Thank you! Invoice ${invoice.invoice_number} has been marked as paid.`,
        `/invoices/${req.params.id}`
      );
    }

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    updated.items = JSON.parse(updated.items);

    res.json({ message: 'Invoice updated successfully', invoice: updated });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Send invoice (change status and notify)
router.post('/:id/send', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.prepare("UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.params.id);

    // Create notification for client
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      invoice.client_id,
      'invoice_received',
      'New Invoice',
      `You have received invoice ${invoice.invoice_number} for $${invoice.total.toFixed(2)}`,
      `/invoices/${req.params.id}`
    );

    // TODO: Send email notification

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Delete invoice (admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete paid invoices' });
    }

    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
