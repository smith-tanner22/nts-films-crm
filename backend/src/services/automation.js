const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
// const nodemailer = require('nodemailer');

// Email transporter (configure in production)
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: process.env.SMTP_PORT,
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

const automationService = {
  // Check and send scheduled reminders
  checkAndSendReminders: async () => {
    try {
      // Check for overdue invoices
      const overdueInvoices = db.prepare(`
        SELECT i.*, u.name as client_name, u.email as client_email
        FROM invoices i
        JOIN users u ON i.client_id = u.id
        WHERE i.status IN ('sent', 'viewed')
        AND i.due_date < date('now')
      `).all();

      for (const invoice of overdueInvoices) {
        // Mark as overdue
        db.prepare("UPDATE invoices SET status = 'overdue', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(invoice.id);

        // Create notification
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          invoice.client_id,
          'invoice_overdue',
          'Invoice Overdue',
          `Invoice ${invoice.invoice_number} is now overdue. Please make payment at your earliest convenience.`,
          `/invoices/${invoice.id}`
        );

        // Log automation
        db.prepare(`
          INSERT INTO automation_logs (id, type, target_type, target_id, action, status, executed_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(uuidv4(), 'invoice_reminder', 'invoice', invoice.id, 'marked_overdue', 'sent');

        console.log(`Invoice ${invoice.invoice_number} marked as overdue`);
      }

      // Check for upcoming filming dates (remind 3 days before)
      const upcomingFilming = db.prepare(`
        SELECT p.*, u.name as client_name, u.email as client_email
        FROM projects p
        JOIN users u ON p.client_id = u.id
        WHERE p.filming_date = date('now', '+3 days')
        AND p.status NOT IN ('completed', 'cancelled')
      `).all();

      for (const project of upcomingFilming) {
        // Check if reminder already sent
        const existingReminder = db.prepare(`
          SELECT id FROM automation_logs
          WHERE target_type = 'project' AND target_id = ?
          AND action = 'filming_reminder_3day'
          AND status = 'sent'
        `).get(project.id);

        if (!existingReminder) {
          // Notify client
          db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            project.client_id,
            'filming_reminder',
            'Filming Reminder',
            `Your filming for "${project.title}" is scheduled for ${project.filming_date}. Please confirm all details are correct.`,
            `/projects/${project.id}`
          );

          // Log
          db.prepare(`
            INSERT INTO automation_logs (id, type, target_type, target_id, action, status, executed_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(uuidv4(), 'filming_reminder', 'project', project.id, 'filming_reminder_3day', 'sent');

          console.log(`Filming reminder sent for project: ${project.title}`);
        }
      }

      // Check for projects marked as delivered (send feedback request after 7 days)
      const deliveredProjects = db.prepare(`
        SELECT p.*, u.name as client_name, u.email as client_email
        FROM projects p
        JOIN users u ON p.client_id = u.id
        WHERE p.status = 'delivered'
        AND p.updated_at <= datetime('now', '-7 days')
      `).all();

      for (const project of deliveredProjects) {
        // Check if feedback request already sent
        const existingFeedback = db.prepare(`
          SELECT id FROM automation_logs
          WHERE target_type = 'project' AND target_id = ?
          AND action = 'feedback_request'
          AND status = 'sent'
        `).get(project.id);

        if (!existingFeedback) {
          // Find feedback questionnaire
          const feedbackQuestionnaire = db.prepare(`
            SELECT id FROM questionnaires
            WHERE title LIKE '%feedback%' OR title LIKE '%satisfaction%'
            AND is_active = 1
            LIMIT 1
          `).get();

          if (feedbackQuestionnaire) {
            // Create questionnaire response with access token
            const responseId = uuidv4();
            const accessToken = uuidv4();

            db.prepare(`
              INSERT INTO questionnaire_responses (id, questionnaire_id, client_id, project_id, responses, access_token)
              VALUES (?, ?, ?, ?, '{}', ?)
            `).run(responseId, feedbackQuestionnaire.id, project.client_id, project.id, accessToken);

            // Notify client
            db.prepare(`
              INSERT INTO notifications (id, user_id, type, title, message, link)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              uuidv4(),
              project.client_id,
              'feedback_request',
              'We\'d Love Your Feedback!',
              `We hope you\'re enjoying your video! Please take a moment to share your experience with "${project.title}".`,
              `/questionnaire/${accessToken}`
            );
          }

          // Log
          db.prepare(`
            INSERT INTO automation_logs (id, type, target_type, target_id, action, status, executed_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(uuidv4(), 'feedback_request', 'project', project.id, 'feedback_request', 'sent');

          console.log(`Feedback request sent for project: ${project.title}`);
        }
      }

      // Process scheduled automation tasks
      const pendingTasks = db.prepare(`
        SELECT * FROM automation_logs
        WHERE status = 'pending'
        AND scheduled_for <= datetime('now')
      `).all();

      for (const task of pendingTasks) {
        // Process based on type
        if (task.type === 'lead_followup' && task.action === 'send_followup_email') {
          const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(task.target_id);
          
          if (lead && lead.status === 'new') {
            // TODO: Send actual email
            console.log(`Would send follow-up email to lead: ${lead.email}`);
            
            // Mark as sent
            db.prepare(`
              UPDATE automation_logs SET status = 'sent', executed_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(task.id);
          } else {
            // Lead was already contacted or doesn't exist
            db.prepare(`
              UPDATE automation_logs SET status = 'sent', executed_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(task.id);
          }
        }
      }

      console.log('Automation check completed');
    } catch (error) {
      console.error('Automation error:', error);
    }
  },

  // Send daily digest to admin
  sendDailyDigest: async () => {
    try {
      const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
      
      if (!admin) return;

      // Get yesterday's stats
      const stats = {
        newLeads: db.prepare(`
          SELECT COUNT(*) as count FROM leads
          WHERE created_at >= date('now', '-1 day')
        `).get().count,
        
        newResponses: db.prepare(`
          SELECT COUNT(*) as count FROM questionnaire_responses
          WHERE submitted_at >= date('now', '-1 day')
        `).get().count,

        projectsCompleted: db.prepare(`
          SELECT COUNT(*) as count FROM projects
          WHERE status = 'completed' AND updated_at >= date('now', '-1 day')
        `).get().count,

        invoicesPaid: db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices
          WHERE status = 'paid' AND paid_date >= date('now', '-1 day')
        `).get(),

        upcomingToday: db.prepare(`
          SELECT COUNT(*) as count FROM calendar_events
          WHERE date(start_datetime) = date('now')
          AND is_available_slot = 0
        `).get().count
      };

      // Create digest notification
      const message = `
Daily Summary:
• ${stats.newLeads} new lead(s)
• ${stats.newResponses} questionnaire response(s)
• ${stats.projectsCompleted} project(s) completed
• ${stats.invoicesPaid.count} invoice(s) paid ($${stats.invoicesPaid.amount.toFixed(2)})
• ${stats.upcomingToday} event(s) scheduled today
      `.trim();

      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        admin.id,
        'daily_digest',
        'Daily Summary',
        message,
        '/insights'
      );

      console.log('Daily digest sent to admin');
    } catch (error) {
      console.error('Daily digest error:', error);
    }
  },

  // Trigger event when project status changes
  onProjectStatusChange: async (projectId, oldStatus, newStatus) => {
    try {
      const project = db.prepare(`
        SELECT p.*, u.name as client_name, u.email as client_email
        FROM projects p
        JOIN users u ON p.client_id = u.id
        WHERE p.id = ?
      `).get(projectId);

      if (!project) return;

      // Status-specific automations
      switch (newStatus) {
        case 'contract_signed':
          // Send welcome packet notification
          db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            project.client_id,
            'project_welcome',
            'Welcome to Your Project!',
            `Thank you for choosing us for "${project.title}"! We\'re excited to work with you.`,
            `/projects/${projectId}`
          );
          break;

        case 'delivered':
          // Schedule feedback request
          db.prepare(`
            INSERT INTO automation_logs (id, type, target_type, target_id, action, status, scheduled_for)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            'feedback_request',
            'project',
            projectId,
            'send_feedback_request',
            'pending',
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
          );
          break;

        case 'completed':
          // Send thank you notification
          db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            project.client_id,
            'project_completed',
            'Project Completed!',
            `"${project.title}" has been marked as complete. Thank you for working with us!`,
            `/projects/${projectId}`
          );
          break;
      }
    } catch (error) {
      console.error('Project status change automation error:', error);
    }
  }
};

module.exports = automationService;
