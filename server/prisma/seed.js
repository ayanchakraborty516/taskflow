import bcrypt from 'bcryptjs';
import prisma from '../src/database/prisma.client.js';

async function main() {
  console.log('Seeding TaskFlow production database...');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create or upsert primary demo user
  const user = await prisma.user.upsert({
    where: { email: 'alex@taskflow.dev' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'alex@taskflow.dev',
      name: 'Alex Mercer',
      password: hashedPassword,
      jobTitle: 'Lead Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    },
  });

  console.log(`Demo user created/updated: ${user.email} (${user.id})`);

  // 2. Create demo workspace
  let workspace = await prisma.workspace.findUnique({
    where: { slug: 'taskflow-hq' },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'TaskFlow HQ',
        slug: 'taskflow-hq',
        description: 'Global engineering and product operations workspace.',
        ownerId: user.id,
        color: '#5757d9',
      },
    });
  }

  // Update user current workspace
  await prisma.user.update({
    where: { id: user.id },
    data: { currentWorkspaceId: workspace.id },
  });

  // Ensure workspace membership as Owner
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: 'Owner' },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'Owner',
    },
  });

  // 3. Create Demo Projects
  let project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, key: 'PLAT' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Core Platform Engine',
        key: 'PLAT',
        description: 'High-velocity backend services, database partitioning, and real-time streaming.',
        category: 'Engineering',
        status: 'in_progress',
        color: '#5757d9',
        leadId: user.id,
      },
    });

    await prisma.projectMember.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        userId: user.id,
      },
    });
  }

  // 4. Create Demo Tasks
  const taskCount = await prisma.task.count({
    where: { workspaceId: workspace.id, projectId: project.id },
  });

  if (taskCount === 0) {
    const task1 = await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        creatorId: user.id,
        assigneeId: user.id,
        title: 'Architect PostgreSQL composite multi-tenant partitioning',
        key: 'PLAT-1',
        description: 'Implement composite foreign keys with [workspaceId, id] on all tenant data tables.',
        priority: 'urgent',
        status: 'done',
        order: 0,
        labels: ['Database', 'PostgreSQL', 'Architecture'],
      },
    });

    const task2 = await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        creatorId: user.id,
        assigneeId: user.id,
        title: 'Implement Kanban contiguous order rebalancing',
        key: 'PLAT-2',
        description: 'Atomic batch updates inside PostgreSQL isolation transactions.',
        priority: 'high',
        status: 'in_progress',
        order: 0,
        labels: ['Kanban', 'Transactions'],
        dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      },
    });

    const task3 = await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        creatorId: user.id,
        assigneeId: user.id,
        title: 'Optimize Largest Contentful Paint and client bundles',
        key: 'PLAT-3',
        description: 'Vite build tree-shaking and gzip asset compression.',
        priority: 'medium',
        status: 'todo',
        order: 0,
        labels: ['Frontend', 'Performance'],
        dueDate: new Date(Date.now() + 86400000 * 5),
      },
    });

    // Subtasks
    await prisma.subtask.createMany({
      data: [
        { workspaceId: workspace.id, taskId: task2.id, title: 'Draft inter-column rebalancing math', completed: true, order: 0 },
        { workspaceId: workspace.id, taskId: task2.id, title: 'Write integration regression tests', completed: false, order: 1 },
      ],
    });

    // Activity
    await prisma.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        projectId: project.id,
        taskId: task1.id,
        action: 'task_created',
        details: 'Architected and completed PostgreSQL multi-tenant foundation.',
      },
    });

    console.log('Sample demo tasks and activities created.');
  }

  console.log('Seeding completed successfully!');
  console.log('Admin login: alex@taskflow.dev / Password123!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

