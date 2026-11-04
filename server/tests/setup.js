import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load base environment configuration from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '7d';

// Ensure test executions target the isolated taskflow_test database
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/taskflow(\?|$)/, '/taskflow_test$1');
} else {
  process.env.DATABASE_URL = 'postgresql://postgres:Ayan%409332@localhost:5432/taskflow_test?schema=public';
}
