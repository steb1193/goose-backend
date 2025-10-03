import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';

interface RedisRoundState {
  id: string;
  startAt: string;
  endAt: string;
  totalPoints: number;
  status: string;
  participants: string[];
  lastUpdate: string;
}

@Injectable()
export class RoundCleanupService {
  constructor(private readonly redisService: RedisConnectionService) {}

  /**
   * Очищает старые данные Redis
   */
  async cleanupOldRedisData() {
    const activeRoundIds = await this.redisService.smembers('active_rounds');

    for (const roundId of activeRoundIds) {
      const stateData = await this.redisService.get(`round:${roundId}:state`);
      if (!stateData) {
        await this.redisService.srem('active_rounds', roundId);
        continue;
      }

      try {
        const state: RedisRoundState = JSON.parse(stateData);
        if (this.shouldCleanupRound(state)) {
          await this.clearRoundData(roundId);
        }
      } catch {
        await this.clearRoundData(roundId);
      }
    }
  }

  private shouldCleanupRound(state: RedisRoundState): boolean {
    const now = new Date();
    const endAt = new Date(state.endAt);
    const lastUpdate = new Date(state.lastUpdate);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return (
      now > endAt || (lastUpdate < oneHourAgo && state.status === 'finished')
    );
  }

  private async clearRoundData(roundId: string) {
    await this.redisService.del(`round:${roundId}:state`);
    await this.redisService.srem('active_rounds', roundId);
    await this.redisService.del(`round:${roundId}:leaderboard`);

    const roundKeys = await this.redisService.keys(`round:${roundId}:*`);
    if (roundKeys.length > 0) {
      for (const key of roundKeys) {
        await this.redisService.del(key);
      }
    }
  }
}
