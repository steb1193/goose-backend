import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';

export interface PubSubMessage {
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
}

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private instanceId: string;
  private subscriber: RedisClientType | null = null;
  private isSubscribed = false;

  constructor(
    private readonly redis: RedisConnectionService,
    private readonly configService: ConfigService,
  ) {
    this.instanceId = `${process.env.HOSTNAME || 'instance'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleInit() {
    if (!this.redis.isRedisConnected()) {
      return;
    }

    try {
      const client = this.redis.getClient();
      this.subscriber = client.duplicate();
      await this.subscriber.connect();

      await this.subscriber.subscribe(
        'goose:inter-instance',
        this.handleMessage.bind(this),
      );
      this.isSubscribed = true;

      console.log(`Redis PubSub initialized for instance: ${this.instanceId}`);
    } catch (error) {
      console.error('Failed to initialize Redis PubSub:', error);
    }
  }

  async onModuleDestroy() {
    if (this.subscriber && this.isSubscribed) {
      try {
        await this.subscriber.unsubscribe('goose:inter-instance');
        this.subscriber.destroy();
        this.isSubscribed = false;
      } catch (error) {
        console.error('Error disconnecting Redis PubSub:', error);
      }
    }
  }

  private handleMessage(message: string) {
    try {
      const parsedMessage: PubSubMessage = JSON.parse(message);

      if (parsedMessage.instanceId === this.instanceId) {
        return;
      }

      this.emit('inter-instance-message', parsedMessage);
    } catch (error) {
      console.error('Error parsing PubSub message:', error);
    }
  }

  async publishUserTap(
    roundId: string,
    userId: string,
    data: { myPoints: number; timestamp: string },
  ) {
    const message: PubSubMessage = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      type: 'user_tap',
      data: {
        roundId,
        userId,
        myPoints: data.myPoints,
        timestamp: data.timestamp,
      },
    };

    await this.publish(message);
  }

  async publishRoundUpdate(
    roundId: string,
    data: {
      id: string;
      startAt: string;
      endAt: string;
      totalPoints: number;
      status: 'cooldown' | 'active' | 'finished';
    },
  ) {
    const message: PubSubMessage = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      type: 'round_update',
      data: {
        roundId,
        id: data.id,
        startAt: data.startAt,
        endAt: data.endAt,
        totalPoints: data.totalPoints,
        status: data.status,
      },
    };

    await this.publish(message);
  }

  async publishRoundFinished(
    roundId: string,
    data: {
      id: string;
      totalPoints: number;
      winner: {
        username: string;
        points: number;
      } | null;
    },
  ) {
    const message: PubSubMessage = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      type: 'round_finished',
      data: {
        roundId,
        id: data.id,
        totalPoints: data.totalPoints,
        winner: data.winner,
      },
    };

    await this.publish(message);
  }

  async publishLeaderboardUpdate(
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
  ) {
    const message: PubSubMessage = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      type: 'leaderboard_update',
      data: {
        roundId,
        id: leaderboard.id,
        status: leaderboard.status,
        totalPoints: leaderboard.totalPoints,
        leaderboard: leaderboard.leaderboard,
      },
    };

    await this.publish(message);
  }

  private async publish(message: PubSubMessage) {
    if (!this.redis.isRedisConnected()) {
      console.warn('Redis not connected, message not published');
      return;
    }

    try {
      await this.redis.publish('goose:inter-instance', JSON.stringify(message));
    } catch (error) {
      console.error('Error publishing message:', error);
    }
  }

  private listeners: Map<string, Array<(data: PubSubMessage) => void>> =
    new Map();

  on(event: string, listener: (data: PubSubMessage) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: string, data: PubSubMessage) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(data));
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  isAvailable(): boolean {
    return this.redis.isRedisConnected() && this.isSubscribed;
  }
}
