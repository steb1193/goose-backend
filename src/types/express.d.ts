import type { UserRole } from './user.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
      };
    }
  }
}

export {};
