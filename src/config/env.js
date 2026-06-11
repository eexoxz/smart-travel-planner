const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseFile: process.env.DATABASE_FILE || './data/travel-planner.sqlite',
  jwtSecret: process.env.JWT_SECRET || 'development_secret_change_before_submission',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100)
};

if (env.nodeEnv === 'production' && env.jwtSecret.includes('change')) {
  throw new Error('JWT_SECRET must be set to a secure value in production.');
}

module.exports = env;
