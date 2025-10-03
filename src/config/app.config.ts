import { registerAs } from '@nestjs/config';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import 'dotenv/config';

export default registerAs('app', () => {
  const cfg = {
    port: parseInt(process.env.GOOSE_API_PORT || '3000', 10),
    wsPort: parseInt(process.env.GOOSE_WS_PORT || '3000', 10),
    nodeEnv: process.env.GOOSE_NODE_ENV || 'development',

    jwt: {
      secret: process.env.GOOSE_JWT_SECRET || 'supersecretkey',
      expiresIn: process.env.GOOSE_JWT_EXPIRES_IN || APP_CONSTANTS.JWT_EXPIRES_IN,
    },

    database: {
      host: process.env.GOOSE_DB_HOST || 'localhost',
      port: parseInt(process.env.GOOSE_DB_PORT || '5433', 10),
      name: process.env.GOOSE_DB_NAME || 'goose_db',
      user: process.env.GOOSE_DB_USER || 'goose_user',
      password: process.env.GOOSE_DB_PASSWORD || 'goose_password',
    },

    redis: {
      url: process.env.GOOSE_REDIS_URL || 'redis://localhost:6379',
      keyPrefix: process.env.GOOSE_REDIS_KEY_PREFIX || APP_CONSTANTS.REDIS_KEY_PREFIX,
      ttl: parseInt(
        process.env.GOOSE_REDIS_TTL || String(APP_CONSTANTS.REDIS_TTL),
        10,
      ),
    },

    game: {
      cooldownDuration: parseInt(process.env.COOLDOWN_DURATION || '30', 10),
      roundDuration: parseInt(process.env.ROUND_DURATION || '60', 10),
      bonusTapInterval: APP_CONSTANTS.BONUS_TAP_INTERVAL,
      bonusPoints: APP_CONSTANTS.BONUS_POINTS,
    },

    throttling: {
      windowMs: APP_CONSTANTS.THROTTLE_WINDOW_MS,
      maxRetries: APP_CONSTANTS.MAX_RETRIES,
    },

    sync: {
      intervalMs: APP_CONSTANTS.SYNC_INTERVAL_MS,
    },
  };
  return cfg;
});
