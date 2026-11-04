import prisma, {
  connectDatabase,
  checkDatabaseHealth,
  disconnectDatabase,
} from '../src/database/prisma.client.js';
import { runInTransaction } from '../src/database/transaction.util.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { cleanDatabase, createTestUser, createTestWorkspace } from '../src/database/test-helper.js';

describe('Database and Repository Foundation Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase();
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('1. Database Connection & Health Check', () => {
    it('connectDatabase should successfully connect to isolated test database', async () => {
      const res = await connectDatabase();
      expect(res).toHaveProperty('connected', true);
      expect(typeof res.latencyMs).toBe('number');
    });

    it('checkDatabaseHealth should return healthy status and target taskflow_test', async () => {
      const health = await checkDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.database).toBe('taskflow_test');
      expect(typeof health.latencyMs).toBe('number');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Basic Prisma Queries', () => {
    it('should execute raw SQL queries ($queryRaw)', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as num;`;
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('num', 1);
    });

    it('should query model counts via Prisma Client', async () => {
      const count = await prisma.user.count();
      expect(typeof count).toBe('number');
      expect(count).toBe(0);
    });
  });

  describe('3. Repository Operations & Dependency Injection', () => {
    it('should create and retrieve a user via UserRepository', async () => {
      const user = await userRepository.create({
        email: 'founder@taskflow.dev',
        name: 'TaskFlow Founder',
        password: '$2a$10$hashedpasswordforexampletestcases12345678',
        jobTitle: 'Founder & CEO',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('founder@taskflow.dev');

      const foundByEmail = await userRepository.findByEmail('FOUNDER@taskflow.dev');
      expect(foundByEmail).not.toBeNull();
      expect(foundByEmail.id).toBe(user.id);

      const foundById = await userRepository.findById(user.id);
      expect(foundById).not.toBeNull();
      expect(foundById.name).toBe('TaskFlow Founder');
    });
  });

  describe('4. Transaction Commit and Rollback', () => {
    it('should commit all operations executed within runInTransaction', async () => {
      const txResult = await runInTransaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email: 'committed_user@example.com',
            name: 'Committed User',
            password: '$2a$10$dummyhashedpassword1234567890abcdef',
          },
        });
        return u;
      });

      expect(txResult).toBeDefined();
      const inDb = await prisma.user.findUnique({
        where: { email: 'committed_user@example.com' },
      });
      expect(inDb).not.toBeNull();
      expect(inDb.email).toBe('committed_user@example.com');
    });

    it('should rollback all operations when an error is thrown inside runInTransaction', async () => {
      const emailToRollback = 'rolledback_user@example.com';

      await expect(
        runInTransaction(async (tx) => {
          await tx.user.create({
            data: {
              email: emailToRollback,
              name: 'Rollback User',
              password: '$2a$10$dummyhashedpassword1234567890abcdef',
            },
          });

          // Simulate an unexpected business error triggering transaction abort
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        })
      ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

      // Verify that the record was NOT created in the database
      const notInDb = await prisma.user.findUnique({
        where: { email: emailToRollback },
      });
      expect(notInDb).toBeNull();
    });
  });

  describe('5. Database Error Handling', () => {
    it('should throw P2002 error when violating unique constraint', async () => {
      const duplicateEmail = 'duplicate@taskflow.dev';

      await userRepository.create({
        email: duplicateEmail,
        name: 'First User',
        password: '$2a$10$dummyhashedpassword1234567890abcdef',
      });

      await expect(
        userRepository.create({
          email: duplicateEmail,
          name: 'Second User',
          password: '$2a$10$dummyhashedpassword1234567890abcdef',
        })
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('should throw P2003 error when violating foreign key constraint', async () => {
      await expect(
        prisma.task.create({
          data: {
            title: 'Orphaned Task',
            workspaceId: 'non_existent_workspace_id',
            projectId: 'non_existent_project_id',
            creatorId: 'non_existent_creator_id',
          },
        })
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });
  });

  describe('6. Subtask Tenant Isolation & Task Key Uniqueness Constraints', () => {
    let wsA, wsB, userA, userB, projA1, projA2, projB, taskA1;

    beforeAll(async () => {
      userA = await createTestUser(prisma);
      userB = await createTestUser(prisma);

      wsA = await createTestWorkspace(prisma, userA.id);
      wsB = await createTestWorkspace(prisma, userB.id);

      projA1 = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Project A1',
          key: 'PA1',
        },
      });

      projA2 = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Project A2',
          key: 'PA2',
        },
      });

      projB = await prisma.project.create({
        data: {
          workspaceId: wsB.id,
          name: 'Project B1',
          key: 'PB1',
        },
      });

      taskA1 = await prisma.task.create({
        data: {
          workspaceId: wsA.id,
          projectId: projA1.id,
          creatorId: userA.id,
          title: 'Task A1',
          key: 'PA1-101',
        },
      });
    });

    it('1. New valid Subtasks can be created with workspaceId matching parent Task', async () => {
      const subtask = await prisma.subtask.create({
        data: {
          workspaceId: wsA.id,
          taskId: taskA1.id,
          title: 'Implement unit test',
        },
      });

      expect(subtask).toBeDefined();
      expect(subtask.id).toBeDefined();
      expect(subtask.workspaceId).toBe(wsA.id);
      expect(subtask.taskId).toBe(taskA1.id);
      expect(subtask.completed).toBe(false);
    });

    it('2. PostgreSQL rejects Subtask referencing a task in a different workspace (P2003)', async () => {
      // Subtask tries to use wsB.id (Workspace B) with taskA1.id (which is in Workspace A)
      await expect(
        prisma.subtask.create({
          data: {
            workspaceId: wsB.id,
            taskId: taskA1.id,
            title: 'Cross-workspace exploit attempt',
          },
        })
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });

    it('3. Deleting a Task cascades to its Subtasks', async () => {
      const taskWithSubtasks = await prisma.task.create({
        data: {
          workspaceId: wsA.id,
          projectId: projA1.id,
          creatorId: userA.id,
          title: 'Task to be deleted',
          key: 'PA1-102',
          subtasks: {
            create: [
              { title: 'Subtask 1' },
              { title: 'Subtask 2' },
            ],
          },
        },
      });

      const countBefore = await prisma.subtask.count({
        where: { taskId: taskWithSubtasks.id },
      });
      expect(countBefore).toBe(2);

      await prisma.task.delete({
        where: { id: taskWithSubtasks.id },
      });

      const countAfter = await prisma.subtask.count({
        where: { taskId: taskWithSubtasks.id },
      });
      expect(countAfter).toBe(0);
    });

    it('4. PostgreSQL rejects duplicate non-null task keys within the same project (P2002)', async () => {
      // taskA1 already has key 'PA1-101' in projA1
      await expect(
        prisma.task.create({
          data: {
            workspaceId: wsA.id,
            projectId: projA1.id,
            creatorId: userA.id,
            title: 'Duplicate Key Task',
            key: 'PA1-101',
          },
        })
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('5. Identical task keys in different projects remain allowed', async () => {
      // projA2 can have 'PA1-101' because it belongs to a different project
      const taskInProjA2 = await prisma.task.create({
        data: {
          workspaceId: wsA.id,
          projectId: projA2.id,
          creatorId: userA.id,
          title: 'Same Key Different Project',
          key: 'PA1-101',
        },
      });

      expect(taskInProjA2).toBeDefined();
      expect(taskInProjA2.key).toBe('PA1-101');
      expect(taskInProjA2.projectId).toBe(projA2.id);

      // projB (in another workspace) can also have 'PA1-101'
      const taskInProjB = await prisma.task.create({
        data: {
          workspaceId: wsB.id,
          projectId: projB.id,
          creatorId: userB.id,
          title: 'Same Key in Another Workspace Project',
          key: 'PA1-101',
        },
      });

      expect(taskInProjB).toBeDefined();
      expect(taskInProjB.key).toBe('PA1-101');
      expect(taskInProjB.projectId).toBe(projB.id);
    });

    it('6. Multiple null task keys within the same project remain allowed', async () => {
      const nullKeyTask1 = await prisma.task.create({
        data: {
          workspaceId: wsA.id,
          projectId: projA1.id,
          creatorId: userA.id,
          title: 'Null Key Task 1',
          key: null,
        },
      });

      const nullKeyTask2 = await prisma.task.create({
        data: {
          workspaceId: wsA.id,
          projectId: projA1.id,
          creatorId: userA.id,
          title: 'Null Key Task 2',
          key: null,
        },
      });

      expect(nullKeyTask1.key).toBeNull();
      expect(nullKeyTask2.key).toBeNull();
      expect(nullKeyTask1.id).not.toBe(nullKeyTask2.id);
    });
  });

  describe('7. Database Disconnection', () => {
    it('disconnectDatabase should cleanly close Prisma connection', async () => {
      await expect(disconnectDatabase()).resolves.toBeUndefined();
    });
  });
});

