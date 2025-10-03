import { Injectable } from '@nestjs/common';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';
import { Round } from '../../rounds/entities/round.entity';
import { RedisLeaderboard } from '../../../infrastructure/persistence/redis-round.repository';

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
export class RoundRecoveryService {
  constructor(
    private readonly roundRepository: PrismaRoundRepository,
    private readonly redisService: RedisConnectionService,
  ) {}

  /**
   * Восстанавливает активные раунды из базы данных в Redis
   */
  async recoverActiveRoundsFromDatabase() {
    const activeRounds =
      await this.roundRepository.findActiveOrUpcomingRounds();

    for (const round of activeRounds) {
      await this.restoreRoundFromDatabase(round);
    }

    await this.recoverActiveRoundsFromRedis();
  }

  /**
   * Восстанавливает активные раунды из Redis в базу данных
   */
  async recoverActiveRoundsFromRedis() {
    const activeRoundIds = await this.redisService.smembers('active_rounds');

    for (const roundId of activeRoundIds) {
      await this.processRedisRound(roundId);
    }
  }

  /**
   * Восстанавливает раунд из базы данных в Redis
   */
  async recoverRoundFromDatabase(roundId: string) {
    try {
      const round = await this.roundRepository.findWithParticipants({
        value: roundId,
      });
      if (!round) {
        await this.redisService.srem('active_rounds', roundId);
        return;
      }

      if (!this.isRoundStillActive(round)) {
        await this.redisService.srem('active_rounds', roundId);
        return;
      }

      await this.restoreRoundFromDatabase(round);
    } catch {
      await this.redisService.srem('active_rounds', roundId);
    }
  }

  private async restoreRoundFromDatabase(round: Round) {
    const roundState = this.createRoundState(round);
    await this.saveRoundState(round.id.value, roundState);

    const leaderboard = this.createLeaderboard(round);
    await this.saveLeaderboard(round.id.value, leaderboard);
  }

  private async processRedisRound(roundId: string) {
    const stateData = await this.redisService.get(`round:${roundId}:state`);
    if (!stateData) {
      await this.recoverRoundFromDatabase(roundId);
      return;
    }

    try {
      const redisState: RedisRoundState = JSON.parse(stateData);
      await this.validateAndUpdateRedisRound(roundId, redisState);
    } catch {
      await this.recoverRoundFromDatabase(roundId);
    }
  }

  private async validateAndUpdateRedisRound(
    roundId: string,
    redisState: RedisRoundState,
  ) {
    const now = new Date();
    const endAt = new Date(redisState.endAt);

    if (now > endAt) {
      await this.clearRoundData(roundId);
      return;
    }

    const startAt = new Date(redisState.startAt);
    const newStatus = this.determineRoundStatus(now, startAt, endAt);

    if (redisState.status !== newStatus) {
      await this.updateRedisRoundStatus(roundId, redisState, newStatus);
    }
  }

  private determineRoundStatus(
    now: Date,
    startAt: Date,
    endAt: Date,
  ): 'cooldown' | 'active' | 'finished' {
    if (now < startAt) return 'cooldown';
    if (now > endAt) return 'finished';
    return 'active';
  }

  private async updateRedisRoundStatus(
    roundId: string,
    redisState: RedisRoundState,
    newStatus: 'cooldown' | 'active' | 'finished',
  ) {
    redisState.status = newStatus;
    redisState.lastUpdate = new Date().toISOString();
    await this.redisService.set(
      `round:${roundId}:state`,
      JSON.stringify(redisState),
    );
  }

  private createRoundState(round: Round) {
    return {
      id: round.id.value,
      startAt: round.timeRange.startAt.toISOString(),
      endAt: round.timeRange.endAt.toISOString(),
      totalPoints: round.points.total,
      status: round.status.value,
      participants: round.participants.map((p) => p.userId),
      lastUpdate: new Date().toISOString(),
    };
  }

  private createLeaderboard(round: Round) {
    return {
      id: round.id.value,
      status: round.status.value,
      totalPoints: round.points.total,
      leaderboard: round.createLeaderboard().map((participant, idx) => ({
        place: idx + 1,
        userId: participant.userId,
        username: participant.username,
        taps: participant.taps,
        points: participant.points,
      })),
    };
  }

  private async saveRoundState(roundId: string, roundState: RedisRoundState) {
    await this.redisService.set(
      `round:${roundId}:state`,
      JSON.stringify(roundState),
    );
    await this.redisService.sadd('active_rounds', roundId);
  }

  private async saveLeaderboard(
    roundId: string,
    leaderboard: RedisLeaderboard,
  ) {
    await this.redisService.set(
      `round:${roundId}:leaderboard`,
      JSON.stringify(leaderboard),
      3600,
    );
  }

  private isRoundStillActive(round: Round): boolean {
    const now = new Date();
    const endAt = round.timeRange.endAt;
    return now <= endAt;
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
