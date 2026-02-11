require('dotenv').config();
const db = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const seed = async () => {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminId = uuidv4();
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password, name, phone, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin@ntsfilms.com', adminPassword, 'NTS Films Admin', '555-0100', 'admin');

  // Create sample clients
  const clients = [
    { name: 'Emily Chen', email: 'emily@example.com', phone: '555-0101', company: null, location: 'Phoenix, AZ', services: 'wedding' },
    { name: 'Mark Thompson', email: 'mark@example.com', phone: '555-0102', company: 'Thompson Industries', location: 'Tucson, AZ', services: 'corporate,event' },
    { name: 'David Martinez', email: 'david@example.com', phone: '555-0103', company: null, location: 'Scottsdale, AZ', services: 'music_video' },
    { name: 'Sarah Johnson', email: 'sarah@example.com', phone: '555-0104', company: 'Johnson Events', location: 'Tempe, AZ', services: 'event,wedding' },
  ];

  const clientIds = [];
  const clientPassword = await bcrypt.hash('client123', 10);

  for (const client of clients) {
    const clientId = uuidv4();
    clientIds.push(clientId);
    
    // Parse location
    const locationParts = client.location.split(',').map(s => s.trim());
    
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password, name, phone, role)
      VALUES (?, ?, ?, ?, ?, 'client')
    `).run(clientId, client.email, clientPassword, client.name, client.phone);

    db.prepare(`
      INSERT OR REPLACE INTO client_profiles (id, user_id, company_name, city, state, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), clientId, client.company, locationParts[0], locationParts[1], client.services);
  }

  // Create sample leads
  const leads = [
    { name: 'Emily Chen', email: 'emily.lead@example.com', phone: '555-0201', service_type: 'event', status: 'contacted' },
    { name: 'Mark Thompson', email: 'mark.lead@example.com', phone: '555-0202', service_type: 'corporate', status: 'new' },
    { name: 'David Martinez', email: 'david.lead@example.com', phone: '555-0203', service_type: 'music_video', status: 'proposal_sent' },
    { name: 'Sarah Johnson', email: 'sarah.lead@example.com', phone: '555-0204', service_type: 'wedding', status: 'qualified' },
  ];

  for (const lead of leads) {
    db.prepare(`
      INSERT INTO leads (id, name, email, phone, service_type, status, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      lead.name,
      lead.email,
      lead.phone,
      lead.service_type,
      lead.status,
      'Sample lead inquiry message'
    );
  }

  // Create sample projects
  const projects = [
    { 
      client_id: clientIds[0], 
      title: 'Chen Wedding', 
      service_type: 'wedding', 
      status: 'in_progress',
      budget: 3500,
      filming_date: '2026-02-15'
    },
    { 
      client_id: clientIds[1], 
      title: 'Thompson Corporate Event', 
      service_type: 'corporate', 
      status: 'editing',
      budget: 5000,
      filming_date: '2026-01-20'
    },
    { 
      client_id: clientIds[2], 
      title: 'Martinez Music Video', 
      service_type: 'music_video', 
      status: 'completed',
      budget: 8500,
      final_price: 8500
    },
  ];

  // Wedding-specific milestones
  const weddingTasks = [
    'Initial Consultation',
    'Send Quote/Proposal',
    'Paid Travel Fee Deposit',
    'Wedding is in Calendar',
    'Week Before Reminder Text Sent',
    'Wedding Filmed',
    'Wedding is Backed Up on Drive',
    'Asked for Wedding Songs',
    'Full Amount Has Been Paid',
    'Wedding Video is Finished',
    'Video is Uploaded to YouTube',
    'YouTube Link is Shared with Client',
    'WeTransfer Link is Sent',
    'Website is Updated with Their Video',
    'Video is on Instagram'
  ];

  // Standard project milestones
  const standardTasks = [
    'Initial Consultation',
    'Send Quote/Proposal',
    'Contract Signing',
    'Deposit Received',
    'Pre-production Planning',
    'Filming Day',
    'Footage Backed Up',
    'Editing & Post-production',
    'Client Review',
    'Revisions Complete',
    'Final Payment Received',
    'Final Delivery',
    'Files Uploaded/Shared'
  ];

  for (const project of projects) {
    const projectId = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, client_id, title, service_type, status, budget, final_price, filming_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      project.client_id,
      project.title,
      project.service_type,
      project.status,
      project.budget,
      project.final_price || null,
      project.filming_date || null
    );

    // Choose tasks based on service type
    const tasks = project.service_type === 'wedding' ? weddingTasks : standardTasks;
    
    // Determine which tasks should be completed based on status
    let completedCount = 0;
    if (project.status === 'in_progress') completedCount = 5;
    else if (project.status === 'editing') completedCount = 8;
    else if (project.status === 'completed') completedCount = tasks.length;

    tasks.forEach((task, index) => {
      db.prepare(`
        INSERT INTO project_tasks (id, project_id, title, completed, order_index)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), projectId, task, index < completedCount ? 1 : 0, index);
    });

    // Create calendar event for filming date
    if (project.filming_date) {
      const client = clients.find(c => c.email === (
        project.client_id === clientIds[0] ? 'emily@example.com' :
        project.client_id === clientIds[1] ? 'mark@example.com' :
        project.client_id === clientIds[2] ? 'david@example.com' : 'sarah@example.com'
      ));
      const eventTitle = project.service_type === 'wedding' 
        ? `${client?.name || 'Client'} Wedding`
        : `${project.title} - Filming`;
      
      db.prepare(`
        INSERT INTO calendar_events (
          id, project_id, client_id, title, event_type,
          start_datetime, end_datetime, location, all_day
        )
        VALUES (?, ?, ?, ?, 'filming', ?, ?, ?, 1)
      `).run(
        uuidv4(),
        projectId,
        project.client_id,
        eventTitle,
        `${project.filming_date}T09:00:00`,
        `${project.filming_date}T18:00:00`,
        project.filming_location || null
      );
    }
  }

  // Create sample questionnaires
  const questionnaires = [
    {
      title: 'Wedding Video Questionnaire',
      description: 'Help us capture your special day perfectly',
      service_type: 'wedding',
      questions: JSON.stringify([
        { id: 'q1', type: 'text', question: 'What is the wedding date and venue?', required: true },
        { id: 'q2', type: 'text', question: 'What time does the ceremony start?', required: true },
        { id: 'q3', type: 'textarea', question: 'Describe your vision for the wedding video', required: true },
        { id: 'q4', type: 'select', question: 'What style do you prefer?', options: ['Cinematic', 'Documentary', 'Traditional', 'Mixed'], required: true },
        { id: 'q5', type: 'textarea', question: 'Are there any specific moments you want captured?', required: false },
        { id: 'q6', type: 'text', question: 'Any songs you\'d like us to consider for the edit?', required: false },
        { id: 'q7', type: 'checkbox', question: 'Additional services needed', options: ['Drone footage', 'Same-day edit', 'Photo booth', 'Live streaming'], required: false },
      ])
    },
    {
      title: 'Corporate Video Brief',
      description: 'Tell us about your corporate video needs',
      service_type: 'corporate',
      questions: JSON.stringify([
        { id: 'q1', type: 'text', question: 'Company name and industry?', required: true },
        { id: 'q2', type: 'select', question: 'Type of video needed?', options: ['Promotional', 'Training', 'Event coverage', 'Testimonials', 'Product demo'], required: true },
        { id: 'q3', type: 'textarea', question: 'What is the main message or goal of this video?', required: true },
        { id: 'q4', type: 'text', question: 'Target audience?', required: true },
        { id: 'q5', type: 'select', question: 'Desired video length?', options: ['30 seconds', '1-2 minutes', '3-5 minutes', '5+ minutes'], required: true },
        { id: 'q6', type: 'textarea', question: 'Any brand guidelines we should follow?', required: false },
      ])
    },
    {
      title: 'Music Video Concept Form',
      description: 'Share your creative vision',
      service_type: 'music_video',
      questions: JSON.stringify([
        { id: 'q1', type: 'text', question: 'Artist/Band name?', required: true },
        { id: 'q2', type: 'text', question: 'Song title and genre?', required: true },
        { id: 'q3', type: 'textarea', question: 'Describe your concept/storyline for the video', required: true },
        { id: 'q4', type: 'textarea', question: 'Visual references or inspiration (links, artists, other videos)?', required: false },
        { id: 'q5', type: 'text', question: 'Preferred filming locations?', required: false },
        { id: 'q6', type: 'select', question: 'Budget range?', options: ['$1,000-$3,000', '$3,000-$5,000', '$5,000-$10,000', '$10,000+'], required: true },
      ])
    },
    {
      title: 'Post-Project Feedback',
      description: 'We\'d love to hear about your experience',
      service_type: null,
      questions: JSON.stringify([
        { id: 'q1', type: 'rating', question: 'Overall satisfaction with the final product?', max: 5, required: true },
        { id: 'q2', type: 'rating', question: 'Communication throughout the project?', max: 5, required: true },
        { id: 'q3', type: 'rating', question: 'Professionalism of our team?', max: 5, required: true },
        { id: 'q4', type: 'rating', question: 'Value for money?', max: 5, required: true },
        { id: 'q5', type: 'textarea', question: 'What did you like most about working with us?', required: false },
        { id: 'q6', type: 'textarea', question: 'How could we improve?', required: false },
        { id: 'q7', type: 'select', question: 'Would you recommend us to others?', options: ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not'], required: true },
      ])
    }
  ];

  for (const q of questionnaires) {
    db.prepare(`
      INSERT INTO questionnaires (id, title, description, service_type, questions)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), q.title, q.description, q.service_type, q.questions);
  }

  // Create sample invoice
  const invoiceId = uuidv4();
  db.prepare(`
    INSERT INTO invoices (id, invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    'INV-2026-001',
    clientIds[2],
    JSON.stringify([
      { description: 'Music Video Production - Full Package', quantity: 1, rate: 7500, amount: 7500 },
      { description: 'Drone footage add-on', quantity: 1, rate: 500, amount: 500 },
      { description: 'Rush delivery', quantity: 1, rate: 500, amount: 500 },
    ]),
    8500,
    0,
    0,
    8500,
    'paid',
    '2026-01-15'
  );

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📧 Admin login: admin@ntsfilms.com / admin123');
  console.log('📧 Client login: emily@example.com / client123');
};

seed().catch(console.error);
