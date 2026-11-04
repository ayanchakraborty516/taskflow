import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';
import { checkDatabaseHealth } from '../database/prisma.client.js';

export class HealthController {
  check = asyncHandler(async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'healthy';

    return ApiResponse.success(
      res,
      {
        status: isHealthy ? 'healthy' : 'degraded',
        app: 'TaskFlow API Server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
      },
      isHealthy ? 'TaskFlow API and database are healthy' : 'Database connectivity issue'
    );
  });
}

export const healthController = new HealthController();
export default healthController;
