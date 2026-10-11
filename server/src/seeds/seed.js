require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const connectDB = require('../config/db');

const seedData = async () => {
  try {
    console.log('[Seed] Connecting to database...');
    await connectDB();

    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Comment.deleteMany({});
    await Activity.deleteMany({});
    await Notification.deleteMany({});

    console.log('[Seed] Creating team users...');
    const defaultPassword = 'Password123!';

    const elena = await User.create({
      name: 'Elena Vance',
      email: 'elena.vance@acmestudio.io',
      password: defaultPassword,
      jobTitle: 'Product Lead',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    });

    const liam = await User.create({
      name: 'Liam Chen',
      email: 'liam.chen@acmestudio.io',
      password: defaultPassword,
      jobTitle: 'Senior Software Engineer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    });

    const maya = await User.create({
      name: 'Maya Lin',
      email: 'maya.lin@acmestudio.io',
      password: defaultPassword,
      jobTitle: 'Senior Product Designer',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    });

    const marcus = await User.create({
      name: 'Marcus Brody',
      email: 'marcus.brody@acmestudio.io',
      password: defaultPassword,
      jobTitle: 'Engineering Director',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    });

    const claire = await User.create({
      name: 'Claire Chen',
      email: 'claire.chen@acmestudio.io',
      password: defaultPassword,
      jobTitle: 'Frontend Architect',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    });

    console.log('[Seed] Creating primary workspace: Acme Studio...');
    const workspace = await Workspace.create({
      name: 'Acme Studio',
      description: 'Central engineering and product workspace for Acme Studio software suites.',
      color: '#5757d9',
      owner: elena._id,
      inviteCode: 'acme2026',
      members: [
        { user: elena._id, role: 'Owner' },
        { user: marcus._id, role: 'Admin' },
        { user: liam._id, role: 'Member' },
        { user: maya._id, role: 'Member' },
        { user: claire._id, role: 'Member' },
      ],
    });

    // Update users' currentWorkspace
    for (const u of [elena, liam, maya, marcus, claire]) {
      u.currentWorkspace = workspace._id;
      await u.save({ validateBeforeSave: false });
    }

    console.log('[Seed] Creating projects...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const projectMobile = await Project.create({
      name: 'Mobile App Redesign v2',
      key: 'MOB',
      description: 'Next-generation mobile iOS and Android app overhaul with biometric auth, smooth transitions, and offline sync.',
      workspace: workspace._id,
      category: 'Design & Eng',
      status: 'in_progress',
      color: '#5757d9',
      icon: 'smartphone',
      lead: elena._id,
      members: [elena._id, liam._id, maya._id, marcus._id],
      targetDate: nextMonth,
      isStarred: true,
    });

    const projectDesignSystem = await Project.create({
      name: 'Design System Core',
      key: 'DSK',
      description: 'Unified tokens, dark mode specs, and accessible web primitives for engineering velocity.',
      workspace: workspace._id,
      category: 'Design & Eng',
      status: 'in_progress',
      color: '#006b56',
      icon: 'palette',
      lead: maya._id,
      members: [maya._id, claire._id, elena._id],
      targetDate: nextWeek,
      isStarred: true,
    });

    const projectCloud = await Project.create({
      name: 'Cloud Infrastructure & Auth',
      key: 'CLD',
      description: 'Zero-trust OAuth2 proxy, API rate limiting, audit logging, and automated container scaling.',
      workspace: workspace._id,
      category: 'Engineering',
      status: 'planning',
      color: '#7c4100',
      icon: 'cloud',
      lead: marcus._id,
      members: [marcus._id, liam._id],
      targetDate: nextMonth,
    });

    const projectMarketing = await Project.create({
      name: 'Marketing Landing & Brand',
      key: 'MKT',
      description: 'Public-facing acquisition pages, feature walkthroughs, and converted sales flows.',
      workspace: workspace._id,
      category: 'Marketing',
      status: 'completed',
      color: '#23856d',
      icon: 'campaign',
      lead: elena._id,
      members: [elena._id, claire._id],
      targetDate: new Date(),
    });

    console.log('[Seed] Creating tasks...');
    // Mobile tasks
    const taskMob1 = await Task.create({
      title: 'Audit biometric passkey fallback on Android 14',
      description: 'Investigate edge cases on Pixel and Samsung devices when fingerprint hardware is temporarily disabled or locked out.',
      key: 'MOB-101',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'todo',
      priority: 'urgent',
      assignee: liam._id,
      creator: elena._id,
      dueDate: tomorrow,
      labels: ['Auth', 'Security'],
      order: 0,
      subtasks: [
        { title: 'Check keyguard fallback intent parameters', completed: false },
        { title: 'Test biometric lockout timeout handling', completed: false },
      ],
    });

    const taskMob2 = await Task.create({
      title: 'Implement OAuth2 Social Logins (Google & Apple)',
      description: 'Integrate Google Sign-In SDK and Sign in with Apple for iOS and Android clients using PKCE authorization grant. Token exchange must route via our central auth gateway endpoint at /api/auth.',
      key: 'MOB-88',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'in_review',
      priority: 'high',
      assignee: liam._id,
      creator: elena._id,
      dueDate: tomorrow,
      labels: ['Security', 'API', 'v2-release'],
      order: 0,
      subtasks: [
        { title: 'Apple private relay email cloaking handled in customer profile payload', completed: true },
        { title: 'State verification parameter validation against CSRF during deep link returns', completed: true },
        { title: 'Biometric prompt chaining immediately after initial token issuance', completed: false },
      ],
    });

    const taskMob3 = await Task.create({
      title: 'Adaptive App Icons & dynamic splash screen bundle',
      description: 'Prepare scalable SVG source vectors and platform-specific mipmap assets across all modern device pixel densities.',
      key: 'MOB-79',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'in_review',
      priority: 'medium',
      assignee: maya._id,
      creator: elena._id,
      dueDate: nextWeek,
      labels: ['Assets', 'Design'],
      order: 1,
      subtasks: [
        { title: 'Export vector drawable XML for Android', completed: true },
        { title: 'Generate asset catalog for Xcode', completed: false },
      ],
    });

    const taskMob4 = await Task.create({
      title: 'Offline sqlite cache synchronization queue',
      description: 'Ensure offline changes are persisted locally and reconciled gracefully when internet connection is restored.',
      key: 'MOB-82',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'in_progress',
      priority: 'high',
      assignee: liam._id,
      creator: marcus._id,
      dueDate: nextWeek,
      labels: ['Offline', 'Engine'],
      order: 0,
    });

    const taskMob5 = await Task.create({
      title: 'Migrate Gradle builds to Kotlin DSL script format',
      description: 'Clean up Groovy buildscripts and standardize module dependency declarations with type-safe accessors.',
      key: 'MOB-74',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'done',
      priority: 'medium',
      assignee: liam._id,
      creator: marcus._id,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      labels: ['Tooling'],
      order: 0,
    });

    const taskMob6 = await Task.create({
      title: 'Update App Store screenshots layout for iPhone 16',
      description: 'Render high-resolution promo screenshots highlighting new team collaboration dashboards and dark mode.',
      key: 'MOB-68',
      workspace: workspace._id,
      project: projectMobile._id,
      status: 'done',
      priority: 'low',
      assignee: maya._id,
      creator: elena._id,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      labels: ['Marketing'],
      order: 1,
    });

    // Design System tasks
    const taskDS1 = await Task.create({
      title: 'Finalize Token Migration & Dark Mode Specs',
      description: 'Establish CSS custom properties for all surface elevations, high-contrast borders, and primary indigo accenting.',
      key: 'DSK-1042',
      workspace: workspace._id,
      project: projectDesignSystem._id,
      status: 'in_progress',
      priority: 'high',
      assignee: elena._id,
      creator: maya._id,
      dueDate: tomorrow,
      labels: ['Tokens', 'Colors'],
      order: 0,
      subtasks: [
        { title: 'Define semantic color mappings for WCAG AAA compliance', completed: true },
        { title: 'Add elevation shadow tokens for modal overlays', completed: true },
      ],
    });

    const taskDS2 = await Task.create({
      title: 'Accessible Keyboard Focus & Modal Trap Primitives',
      description: 'Implement focus trap, ESC key dismissal, and visible outline indicators for all dialogs and drawers.',
      key: 'DSK-1045',
      workspace: workspace._id,
      project: projectDesignSystem._id,
      status: 'todo',
      priority: 'medium',
      assignee: claire._id,
      creator: elena._id,
      dueDate: nextWeek,
      labels: ['A11y', 'Components'],
      order: 0,
    });

    // Cloud tasks
    const taskCloud1 = await Task.create({
      title: 'Setup API Gateway Rate Limiting & Audit Logging',
      description: 'Configure distributed token bucket rate limiting on authentication routes and write structured audit records for security events.',
      key: 'CLD-201',
      workspace: workspace._id,
      project: projectCloud._id,
      status: 'in_progress',
      priority: 'urgent',
      assignee: marcus._id,
      creator: marcus._id,
      dueDate: tomorrow,
      labels: ['Security', 'Infra'],
      order: 0,
    });

    console.log('[Seed] Creating comments...');
    await Comment.create({
      task: taskMob2._id,
      workspace: workspace._id,
      author: elena._id,
      content: 'Liam, please verify how Apple private relay email cloaking behaves when the user chooses "Hide My Email". We want to make sure their profile name still pulls correctly.',
    });

    await Comment.create({
      task: taskMob2._id,
      workspace: workspace._id,
      author: liam._id,
      content: 'Tested on TestFlight build 43! Apple sends the real name in the initial identityToken payload, which we now cache properly in our MongoDB profile record.',
    });

    await Comment.create({
      task: taskDS1._id,
      workspace: workspace._id,
      author: maya._id,
      content: 'The new #5757D9 primary accent gives much crisper contrast against our #FAF9FD canvas base than standard blue.',
    });

    console.log('[Seed] Creating activity stream...');
    await Activity.create({
      workspace: workspace._id,
      project: projectMobile._id,
      task: taskMob2._id,
      user: liam._id,
      action: 'status_changed',
      details: 'Liam Chen moved "Implement OAuth2 Social Logins" to In Review',
    });

    await Activity.create({
      workspace: workspace._id,
      project: projectMobile._id,
      task: taskMob1._id,
      user: elena._id,
      action: 'created_task',
      details: 'Elena Vance created task "Audit biometric passkey fallback on Android 14"',
    });

    await Activity.create({
      workspace: workspace._id,
      project: projectDesignSystem._id,
      task: taskDS1._id,
      user: elena._id,
      action: 'status_changed',
      details: 'Elena Vance updated task "Finalize Token Migration & Dark Mode Specs"',
    });

    await Activity.create({
      workspace: workspace._id,
      project: projectMobile._id,
      user: marcus._id,
      action: 'created_project',
      details: 'Marcus Brody launched milestone Sprint W43 for Mobile App v2',
    });

    console.log('[Seed] Creating user notifications...');
    await Notification.create({
      workspace: workspace._id,
      recipient: elena._id,
      sender: liam._id,
      type: 'task_status',
      title: 'Task Moved to In Review',
      message: 'Liam Chen submitted "Implement OAuth2 Social Logins" for code review.',
      link: `/projects/${projectMobile._id}/board?taskId=${taskMob2._id}`,
      read: false,
    });

    await Notification.create({
      workspace: workspace._id,
      recipient: elena._id,
      sender: maya._id,
      type: 'comment_added',
      title: 'New Discussion',
      message: 'Maya Lin commented on "Finalize Token Migration & Dark Mode Specs"',
      link: `/projects/${projectDesignSystem._id}/board?taskId=${taskDS1._id}`,
      read: false,
    });

    await Notification.create({
      workspace: workspace._id,
      recipient: elena._id,
      sender: marcus._id,
      type: 'system',
      title: 'Sprint Velocity Ahead',
      message: 'Sprint W43 is currently at 94% velocity with 28 completed tasks.',
      link: `/dashboard`,
      read: true,
    });

    console.log('\n========================================');
    console.log('🎉 TASKFLOW DATABASE SEEDED SUCCESSFULLY!');
    console.log('========================================');
    console.log('Default test accounts:');
    console.log('1. Elena Vance (Product Lead / Workspace Owner):');
    console.log('   Email: elena.vance@acmestudio.io');
    console.log('   Password: Password123!');
    console.log('2. Liam Chen (Senior Software Engineer):');
    console.log('   Email: liam.chen@acmestudio.io');
    console.log('   Password: Password123!');
    console.log('Workspace: "Acme Studio" (Code: acme2026)');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedData();
