const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Test route - you can remove this later
router.get('/test', (req, res) => {
  res.json({ message: 'Settings route is working!' });
});

// Get business settings (admin only)
router.get('/business', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();
    res.json({ settings: settings || {} });
  } catch (error) {
    console.error('Get business settings error:', error);
    res.status(500).json({ error: 'Failed to fetch business settings' });
  }
});

// Update business settings (admin only)
router.put('/business', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const {
      company_name, company_email, company_phone, company_address,
      company_city, company_state, company_zip, tax_rate, payment_terms, invoice_footer
    } = req.body;

    // Check if settings exist
    const existing = db.prepare('SELECT id FROM business_settings LIMIT 1').get();

    if (existing) {
      db.prepare(`
        UPDATE business_settings SET
          company_name = ?, company_email = ?, company_phone = ?, company_address = ?,
          company_city = ?, company_state = ?, company_zip = ?, tax_rate = ?,
          payment_terms = ?, invoice_footer = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        company_name, company_email, company_phone, company_address,
        company_city, company_state, company_zip, tax_rate,
        payment_terms, invoice_footer, existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO business_settings (
          company_name, company_email, company_phone, company_address,
          company_city, company_state, company_zip, tax_rate, payment_terms, invoice_footer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        company_name, company_email, company_phone, company_address,
        company_city, company_state, company_zip, tax_rate, payment_terms, invoice_footer
      );
    }

    const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();
    res.json({ message: 'Business settings updated', settings });
  } catch (error) {
    console.error('Update business settings error:', error);
    res.status(500).json({ error: 'Failed to update business settings' });
  }
});

module.exports = router;