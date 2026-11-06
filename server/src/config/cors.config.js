import env from './env.config.js';

const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

const configuredProdOrigins = env.CLIENT_URL
  ? env.CLIENT_URL.split(',').map((url) => url.trim()).filter(Boolean)
  : [];

const allowedOrigins = env.NODE_ENV === 'production'
  ? configuredProdOrigins.length > 0 ? configuredProdOrigins : ['http://localhost:5173']
  : [...devOrigins, ...configuredProdOrigins];

export const corsOptions = {
  origin: (origin, callback) => {
    // Permit requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    try {
      const hostname = new URL(origin).hostname;
      if (/\.(vercel\.app|onrender\.com|netlify\.app)$/.test(hostname)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid origin URL
    }

    // If CLIENT_URL was not explicitly configured in production, allow the origin
    if (configuredProdOrigins.length === 0) {
      return callback(null, true);
    }

    if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: Origin ${origin} not permitted.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id'],
  exposedHeaders: ['set-cookie'],
};

export default corsOptions;

