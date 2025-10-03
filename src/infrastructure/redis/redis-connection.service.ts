import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisConnectionService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });

    try {
      await this.client.connect();
      this.isConnected = true;
    } catch {
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  getClient(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected.');
    }
    return this.client;
  }

  async set(key: string, value: string, ttl?: number): Promise<string | null> {
    if (!this.isConnected) return null;
    if (ttl) {
      return this.client.set(key, value, { EX: ttl });
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const res = await this.client.exists(key);
    return res > 0;
  }

  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected) return false;
    const result = await this.client.expire(key, ttl);
    return result === 1;
  }

  async sadd(key: string, member: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.sAdd(key, member);
  }

  async srem(key: string, member: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.sRem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isConnected) return [];
    return this.client.sMembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.isConnected) return false;
    return (await this.client.sIsMember(key, member)) === 1;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.hSet(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isConnected) return null;
    return this.client.hGet(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isConnected) return {};
    return this.client.hGetAll(key);
  }

  async hdel(key: string, field: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.hDel(key, field);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    return this.client.keys(pattern);
  }

  async flushAll(): Promise<string> {
    if (!this.isConnected) return 'ERR';
    return this.client.flushAll();
  }

  async ping(): Promise<string> {
    if (!this.isConnected) return 'PONG (disconnected)';
    return this.client.ping();
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.isConnected) return 0;
    return this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    listener: (message: string, channel: string) => void,
  ): Promise<void> {
    if (!this.isConnected) return;
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, listener);
  }
}
