import { Injectable } from '@nestjs/common';
import { WebSocketConnectionService } from './websocket-connection.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';

interface RoundUpdateMessage {
  id: string;
  startAt: string;
  endAt: string;
  totalPoints: number;
  status: 'cooldown' | 'active' | 'finished';
  timestamp: string;
}

interface UserTapMessage {
  userId: string;
  myPoints: number;
  timestamp: string;
}

interface LeaderboardMessage {
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

interface RoundFinishedMessage {
  id: string;
  totalPoints: number;
  winner: {
    username: string;
    points: number;
  } | null;
  timestamp: string;
}

@Injectable()
export class WebSocketBroadcastService {
  constructor(
    private readonly connectionService: WebSocketConnectionService,
    private readonly pubSubService: RedisPubSubService,
  ) {}

  broadcastToRoom(
    room: string,
    event: string,
    data:
      | RoundUpdateMessage
      | UserTapMessage
      | LeaderboardMessage
      | RoundFinishedMessage,
  ): void {
    if (!this.connectionService.isServerAvailable()) return;

    const server = this.connectionService['server'];
    server.to(room).emit(event, data);
  }

  broadcastToAll(
    event: string,
    data: RoundUpdateMessage | RoundFinishedMessage,
  ): void {
    if (!this.connectionService.isServerAvailable()) return;

    const server = this.connectionService['server'];
    server.emit(event, data);
  }

  broadcastToClient(
    clientId: string,
    event: string,
    data:
      | RoundUpdateMessage
      | UserTapMessage
      | LeaderboardMessage
      | RoundFinishedMessage,
  ): void {
    if (!this.connectionService.isServerAvailable()) return;

    const server = this.connectionService['server'];
    server.to(clientId).emit(event, data);
  }

  broadcastUserTap(
    roundId: string,
    userId: string,
    data: { myPoints: number; timestamp: string },
  ): void {
    const message: UserTapMessage = {
      userId,
      myPoints: data.myPoints,
      timestamp: data.timestamp,
    };

    this.broadcastToRoom(roundId, 'round.user_tap', message);

    if (this.pubSubService.isAvailable()) {
      void this.pubSubService.publishUserTap(roundId, userId, data);
    }
  }

  broadcastRoundUpdate(
    roundId: string,
    data: {
      id: string;
      startAt: string;
      endAt: string;
      totalPoints: number;
      status: 'cooldown' | 'active' | 'finished';
    },
  ): void {
    const message: RoundUpdateMessage = {
      id: roundId,
      startAt: data.startAt,
      endAt: data.endAt,
      totalPoints: data.totalPoints,
      status: data.status,
      timestamp: new Date().toISOString(),
    };

    this.broadcastToAll('round_update', message);
    this.broadcastToRoom(roundId, 'round_update', message);

    if (this.pubSubService.isAvailable()) {
      void this.pubSubService.publishRoundUpdate(roundId, data);
    }
  }

  broadcastRoundFinished(
    roundId: string,
    data: {
      id: string;
      totalPoints: number;
      winner: {
        username: string;
        points: number;
      } | null;
    },
  ): void {
    const message: RoundFinishedMessage = {
      id: roundId,
      totalPoints: data.totalPoints,
      winner: data.winner,
      timestamp: new Date().toISOString(),
    };

    this.broadcastToRoom(roundId, 'round_finished', message);
    this.broadcastToAll('round_finished', message);

    if (this.pubSubService.isAvailable()) {
      void this.pubSubService.publishRoundFinished(roundId, data);
    }
  }

  broadcastLeaderboard(
    roundId: string,
    leaderboard: {
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
    },
  ): void {
    const message: LeaderboardMessage = {
      ...leaderboard,
      timestamp: new Date().toISOString(),
    };

    this.broadcastToRoom(roundId, 'leaderboard', message);

    if (this.pubSubService.isAvailable()) {
      void this.pubSubService.publishLeaderboardUpdate(roundId, leaderboard);
    }
  }

  broadcastNewRound(roundId: string, startAt: Date, endAt: Date): void {
    const message: RoundUpdateMessage = {
      id: roundId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      totalPoints: 0,
      status: 'cooldown',
      timestamp: new Date().toISOString(),
    };

    this.broadcastToAll('round_update', message);

    if (this.pubSubService.isAvailable()) {
      void this.pubSubService.publishRoundUpdate(roundId, {
        id: roundId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        totalPoints: 0,
        status: 'cooldown',
      });
    }
  }

  handleInterInstanceMessage(message: {
    instanceId: string;
    timestamp: string;
    type: 'user_tap' | 'round_update' | 'round_finished' | 'leaderboard_update';
    data: {
      roundId: string;
      userId?: string;
      myPoints?: number;
      timestamp?: string;
      id?: string;
      startAt?: string;
      endAt?: string;
      totalPoints?: number;
      status?: 'cooldown' | 'active' | 'finished';
      winner?: {
        username: string;
        points: number;
      } | null;
      leaderboard?: Array<{
        place: number;
        userId: string;
        username: string;
        taps: number;
        points: number;
      }>;
    };
  }): void {
    const { type, data } = message;

    switch (type) {
      case 'user_tap': {
        if (!data.userId || !data.myPoints || !data.timestamp) return;

        const userTapMessage: UserTapMessage = {
          userId: data.userId,
          myPoints: data.myPoints,
          timestamp: data.timestamp,
        };

        this.broadcastToRoom(data.roundId, 'round.user_tap', userTapMessage);
        break;
      }

      case 'round_update': {
        if (
          !data.id ||
          !data.startAt ||
          !data.endAt ||
          !data.totalPoints ||
          !data.status
        )
          return;

        const roundUpdateMessage: RoundUpdateMessage = {
          id: data.id,
          startAt: data.startAt,
          endAt: data.endAt,
          totalPoints: data.totalPoints,
          status: data.status,
          timestamp: message.timestamp,
        };

        this.broadcastToAll('round_update', roundUpdateMessage);
        this.broadcastToRoom(data.roundId, 'round_update', roundUpdateMessage);
        break;
      }

      case 'round_finished': {
        if (!data.id || !data.totalPoints) return;

        const roundFinishedMessage: RoundFinishedMessage = {
          id: data.id,
          totalPoints: data.totalPoints,
          winner: data.winner || null,
          timestamp: message.timestamp,
        };

        this.broadcastToRoom(
          data.roundId,
          'round_finished',
          roundFinishedMessage,
        );
        this.broadcastToAll('round_finished', roundFinishedMessage);
        break;
      }

      case 'leaderboard_update': {
        if (!data.id || !data.status || !data.totalPoints || !data.leaderboard)
          return;

        const leaderboardMessage: LeaderboardMessage = {
          id: data.id,
          status: data.status,
          totalPoints: data.totalPoints,
          leaderboard: data.leaderboard,
          timestamp: message.timestamp,
        };

        this.broadcastToRoom(data.roundId, 'leaderboard', leaderboardMessage);
        break;
      }
    }
  }
}
