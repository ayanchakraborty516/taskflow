import prisma, { getPrismaClient } from './prisma.client.js';
import logger from '../utils/logger.util.js';

/**
 * Safely clears all data from the database in reverse foreign key order.
 * Strictly guarded to only execute when NODE_ENV === 'test'.
 */
export const cleanDatabase = async (client = prisma) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing to clean database: NODE_ENV is not "test".');
  }

  const db = client || getPrismaClient();

  // Execute deletion in reverse dependency order
  await db.refreshToken.deleteMany({});
  await db.activity.deleteMany({});
  await db.comment.deleteMany({});
  await db.subtask.deleteMany({});
  await db.task.deleteMany({});
  await db.projectMember.deleteMany({});
  await db.project.deleteMany({});
  await db.notification.deleteMany({});
  await db.workspaceMember.deleteMany({});
  await db.workspace.deleteMany({});
  await db.user.deleteMany({});
};

/**
 * Creates a unique mock user for test suites.
 */
export const createTestUser = async (client = prisma, overrides = {}) => {
  const db = client || getPrismaClient();
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  return db.user.create({
    data: {
      email: `test_user_${uniqueSuffix}@example.com`,
      name: `Test User ${uniqueSuffix}`,
      password: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH', // valid bcrypt format
      jobTitle: 'Software Engineer',
      ...overrides,
    },
  });
};

/**
 * Creates a test workspace with owner and initial membership.
 */
export const createTestWorkspace = async (client = prisma, ownerId, overrides = {}) => {
  const db = client || getPrismaClient();
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  return db.workspace.create({
    data: {
      name: `Test Workspace ${uniqueSuffix}`,
      slug: `test-workspace-${uniqueSuffix}`,
      description: 'Workspace created for integration testing',
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'Owner',
        },
      },
      ...overrides,
    },
    include: {
      members: true,
    },
  });
};

export default {
  cleanDatabase,
  createTestUser,
  createTestWorkspace,
};

