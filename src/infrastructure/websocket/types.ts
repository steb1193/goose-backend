import { Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../types/user.types';

export interface ExtendedSocket extends Socket {
  user?: AuthenticatedUser;
}

export interface WebSocketMessage {
  event: string;
  data: unknown;
  timestamp: string;
}

export interface RoundUpdateMessage {
  id: string;
  startAt: string;
  endAt: string;
  totalPoints: number;
  status: 'cooldown' | 'active' | 'finished';
  timestamp: string;
}

export interface UserTapMessage {
  userId: string;
  myPoints: number;
  timestamp: string;
}

export interface LeaderboardMessage {
  id: string;
  status: 'cooldown' | 'active' | 'finished';
  totalPoints: number;
  leaderboard: Array<{
    place: number;
    userId: string;
    username: string;
    taps: number;
    points: number;
  }>;
  timestamp: string;
}
