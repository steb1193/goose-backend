export const APP_CONSTANTS = {
  THROTTLE_WINDOW_MS: 100, // 100ms между тапами
  MAX_RETRIES: 3,

  JWT_EXPIRES_IN: '7d',
  COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours

  REDIS_KEY_PREFIX: 'goose:',
  REDIS_TTL: 60 * 60, // 1 hour

  SYNC_INTERVAL_MS: 2000, // 2 seconds

  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,
  MIN_PASSWORD_LENGTH: 6,

  BONUS_TAP_INTERVAL: 11, // каждый 11-й тап дает бонус
  BONUS_POINTS: 10,
} as const;

export const ROUND_STATUS = {
  COOLDOWN: 'cooldown',
  ACTIVE: 'active',
  FINISHED: 'finished',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  SURVIVOR: 'survivor',
  NIKITA: 'nikita',
} as const;
