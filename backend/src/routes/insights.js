const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get dashboard overview stats
router.get('/overview', (req, res) => {
  try {
    const { range = '6months' } = req.query;
    
    // Determine date range
    let dateFilter;
    switch (range) {
      case '30days': dateFilter = "date('now', '-30 days')"; break;
      case '3months': dateFilter = "date('now', '-3 months')"; break;
      case '6months': dateFilter = "date('now', '-6 months')"; break;
      case '1year': dateFilter = "date('now', '-12 months')"; break;
      default: dateFilter = "date('now', '-6 months')";
    }

    // Revenue stats
    const revenueStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'viewed') THEN total ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END), 0) as overdue
      FROM invoices
    `).get();

    // Previous period revenue for comparison
    const prevRevenueStats = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as prev_revenue
      FROM invoices
      WHERE status = 'paid'
      AND paid_date < ${dateFilter}
      AND paid_date >= date(${dateFilter}, '-6 months')
    `).get();

    const revenueChange = prevRevenueStats.prev_revenue > 0 
      ? (((revenueStats.total_revenue - prevRevenueStats.prev_revenue) / prevRevenueStats.prev_revenue) * 100).toFixed(1)
      : 0;

    // Project stats
    const projectStats = db.prepare(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects
      FROM projects
    `).get();

    // Client stats
    const clientStats = db.prepare(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN created_at >= ${dateFilter} THEN 1 END) as new_clients
      FROM users WHERE role = 'client'
    `).get();

    // Lead stats
    const leadStats = db.prepare(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads
      FROM leads
    `).get();

    const conversionRate = leadStats.total_leads > 0 
      ? ((leadStats.converted_leads / leadStats.total_leads) * 100).toFixed(1)
      : 0;

    // Revenue by month
    const revenueByMonth = db.prepare(`
      SELECT 
        strftime('%Y-%m', COALESCE(paid_date, created_at)) as month_key,
        strftime('%b', COALESCE(paid_date, created_at)) as month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as revenue,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as projects
      FROM invoices
      WHERE COALESCE(paid_date, created_at) >= date('now', '-6 months')
      GROUP BY month_key
      ORDER BY month_key ASC
    `).all();

    // Projects by status
    const projectsByStatus = db.prepare(`
      SELECT 
        CASE 
          WHEN status IN ('inquiry', 'quote_sent', 'contract_signed') THEN 'Pending'
          WHEN status IN ('scheduled', 'in_progress') THEN 'In Progress'
          WHEN status = 'editing' THEN 'Editing'
          WHEN status IN ('review', 'delivered') THEN 'Review'
          WHEN status = 'completed' THEN 'Completed'
          ELSE 'Other'
        END as status,
        COUNT(*) as count
      FROM projects
      GROUP BY 1
    `).all();

    // Add colors to status
    const statusColors = {
      'Pending': 'bg-yellow-500',
      'In Progress': 'bg-blue-500',
      'Editing': 'bg-purple-500',
      'Review': 'bg-orange-500',
      'Completed': 'bg-green-500',
      'Other': 'bg-gray-500'
    };
    projectsByStatus.forEach(p => {
      p.color = statusColors[p.status] || 'bg-gray-500';
    });

    // Projects by service type with revenue
    const projectsByType = db.prepare(`
      SELECT 
        CASE service_type
          WHEN 'wedding' THEN 'Wedding'
          WHEN 'corporate' THEN 'Corporate'
          WHEN 'music_video' THEN 'Music Video'
          WHEN 'event' THEN 'Event'
          WHEN 'commercial' THEN 'Commercial'
          ELSE 'Other'
        END as type,
        COUNT(*) as count,
        COALESCE(SUM(final_price), SUM(budget), 0) as revenue
      FROM projects
      GROUP BY service_type
      ORDER BY revenue DESC
    `).all();

    // Top clients by revenue
    const topClients = db.prepare(`
      SELECT 
        u.name,
        COUNT(DISTINCT p.id) as projects,
        COALESCE(SUM(i.total), 0) as revenue
      FROM users u
      LEFT JOIN projects p ON u.id = p.client_id
      LEFT JOIN invoices i ON u.id = i.client_id AND i.status = 'paid'
      WHERE u.role = 'client'
      GROUP BY u.id
      HAVING revenue > 0
      ORDER BY revenue DESC
      LIMIT 5
    `).all();

    // Recent activity
    const recentActivity = [];
    
    // Get recent completed projects
    const completedProjects = db.prepare(`
      SELECT title, updated_at FROM projects 
      WHERE status = 'completed' 
      ORDER BY updated_at DESC LIMIT 2
    `).all();
    completedProjects.forEach(p => {
      recentActivity.push({
        type: 'project_completed',
        message: `${p.title} completed`,
        time: formatTimeAgo(p.updated_at)
      });
    });

    // Get recent paid invoices
    const paidInvoices = db.prepare(`
      SELECT invoice_number, total, paid_date FROM invoices 
      WHERE status = 'paid' 
      ORDER BY paid_date DESC LIMIT 2
    `).all();
    paidInvoices.forEach(i => {
      recentActivity.push({
        type: 'invoice_paid',
        message: `Invoice ${i.invoice_number} paid ($${i.total.toLocaleString()})`,
        time: formatTimeAgo(i.paid_date)
      });
    });

    // Get recent converted leads
    const convertedLeads = db.prepare(`
      SELECT name, updated_at FROM leads 
      WHERE status = 'converted' 
      ORDER BY updated_at DESC LIMIT 2
    `).all();
    convertedLeads.forEach(l => {
      recentActivity.push({
        type: 'lead_converted',
        message: `New lead converted: ${l.name}`,
        time: formatTimeAgo(l.updated_at)
      });
    });

    res.json({
      stats: {
        revenue: { total: revenueStats.total_revenue, change: parseFloat(revenueChange) },
        projects: { 
          total: projectStats.total_projects, 
          active: projectStats.active_projects, 
          completed: projectStats.completed_projects,
          change: 8.3 // Placeholder
        },
        clients: { 
          total: clientStats.total_clients, 
          new: clientStats.new_clients,
          change: clientStats.new_clients > 0 ? 22.2 : 0
        },
        leads: { 
          total: leadStats.total_leads, 
          converted: leadStats.converted_leads,
          conversionRate: parseFloat(conversionRate)
        },
        invoices: {
          paid: revenueStats.total_revenue,
          pending: revenueStats.pending,
          overdue: revenueStats.overdue
        }
      },
      revenueByMonth,
      projectsByStatus,
      projectsByType,
      topClients,
      recentActivity: recentActivity.slice(0, 5)
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// Helper function to format time ago
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

// Get lead analytics
router.get('/leads', (req, res) => {
  try {
    const { period = '12months' } = req.query;

    // Leads by status
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM leads
      GROUP BY status
    `).all();

    // Leads by service type
    const byServiceType = db.prepare(`
      SELECT service_type, COUNT(*) as count
      FROM leads
      WHERE service_type IS NOT NULL
      GROUP BY service_type
    `).all();

    // Leads by source
    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM leads
      GROUP BY source
    `).all();

    // Leads over time (monthly)
    const overTime = db.prepare(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted
      FROM leads
      WHERE created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `).all();

    // Conversion funnel
    const funnel = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('contacted', 'qualified', 'proposal_sent', 'negotiating', 'converted') THEN 1 END) as contacted,
        COUNT(CASE WHEN status IN ('qualified', 'proposal_sent', 'negotiating', 'converted') THEN 1 END) as qualified,
        COUNT(CASE WHEN status IN ('proposal_sent', 'negotiating', 'converted') THEN 1 END) as proposal_sent,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted
      FROM leads
    `).get();

    res.json({ byStatus, byServiceType, bySource, overTime, funnel });
  } catch (error) {
    console.error('Get lead analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch lead analytics' });
  }
});

// Get revenue analytics
router.get('/revenue', (req, res) => {
  try {
    // Revenue by month
    const byMonth = db.prepare(`
      SELECT 
        strftime('%Y-%m', paid_date) as month,
        SUM(total) as revenue,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE status = 'paid' AND paid_date IS NOT NULL
      AND paid_date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', paid_date)
      ORDER BY month ASC
    `).all();

    // Revenue by service type
    const byServiceType = db.prepare(`
      SELECT 
        p.service_type,
        SUM(i.total) as revenue,
        COUNT(*) as count
      FROM invoices i
      JOIN projects p ON i.project_id = p.id
      WHERE i.status = 'paid'
      GROUP BY p.service_type
    `).all();

    // Average project value
    const avgProjectValue = db.prepare(`
      SELECT 
        AVG(total) as average,
        MIN(total) as min_value,
        MAX(total) as max_value
      FROM invoices
      WHERE status = 'paid'
    `).get();

    // Top clients by revenue
    const topClients = db.prepare(`
      SELECT 
        u.id, u.name, u.email,
        SUM(i.total) as total_revenue,
        COUNT(i.id) as invoice_count
      FROM invoices i
      JOIN users u ON i.client_id = u.id
      WHERE i.status = 'paid'
      GROUP BY u.id
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all();

    res.json({ byMonth, byServiceType, avgProjectValue, topClients });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// Get project analytics
router.get('/projects', (req, res) => {
  try {
    // Projects by status
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM projects
      GROUP BY status
    `).all();

    // Projects by service type
    const byServiceType = db.prepare(`
      SELECT service_type, COUNT(*) as count
      FROM projects
      GROUP BY service_type
    `).all();

    // Average project duration (for completed projects)
    const avgDuration = db.prepare(`
      SELECT 
        AVG(julianday(updated_at) - julianday(created_at)) as avg_days
      FROM projects
      WHERE status = 'completed'
    `).get();

    // Projects completed per month
    const completedPerMonth = db.prepare(`
      SELECT 
        strftime('%Y-%m', updated_at) as month,
        COUNT(*) as count
      FROM projects
      WHERE status = 'completed'
      AND updated_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', updated_at)
      ORDER BY month ASC
    `).all();

    res.json({ byStatus, byServiceType, avgDuration, completedPerMonth });
  } catch (error) {
    console.error('Get project analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

// Get activity feed
router.get('/activity', (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const activities = db.prepare(`
      SELECT al.*, u.name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(parseInt(limit));

    activities.forEach(a => {
      if (a.details) {
        try {
          a.details = JSON.parse(a.details);
        } catch (e) {}
      }
    });

    res.json({ activities });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;
