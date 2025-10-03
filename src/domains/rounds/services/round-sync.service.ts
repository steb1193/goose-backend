import { Injectable } from '@nestjs/common';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';
import { GooseWebSocketGateway } from '../../../infrastructure/websocket/websocket.gateway';

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
export class RoundSyncService {
  constructor(
    private readonly roundRepository: PrismaRoundRepository,
    private readonly redisService: RedisConnectionService,
    private readonly websocketGateway: GooseWebSocketGateway,
  ) {}

  /**
   * Синхронизирует Redis с базой данных
   */
  async syncRedisToDatabase() {
    const activeRoundIds = await this.redisService.smembers('active_rounds');

    for (const roundId of activeRoundIds) {
      const redisStateData = await this.redisService.get(
        `round:${roundId}:state`,
      );
      if (!redisStateData) {
        await this.redisService.srem('active_rounds', roundId);
        continue;
      }

      try {
        const redisState: RedisRoundState = JSON.parse(redisStateData);
        await this.syncSingleRoundFromRedisToDatabase(roundId, redisState);
      } catch {
        await this.redisService.srem('active_rounds', roundId);
      }
    }
  }

  /**
   * Синхронизирует один раунд из Redis в базу данных
   */
  private async syncSingleRoundFromRedisToDatabase(
    roundId: string,
    redisState: RedisRoundState,
  ) {
    await this.ensureRoundExistsInDatabase(roundId, redisState);
    await this.syncRoundPoints(roundId, redisState);
    await this.handleFinishedRound(roundId, redisState);
  }

  private async ensureRoundExistsInDatabase(
    roundId: string,
    redisState: RedisRoundState,
  ) {
    const dbRound = await this.roundRepository.findById({ value: roundId });

    if (!dbRound) {
      await this.roundRepository.create(
        {
          startAt: new Date(redisState.startAt),
          endAt: new Date(redisState.endAt),
        },
        roundId,
      );
    }
  }

  private async syncRoundPoints(roundId: string, redisState: RedisRoundState) {
    const currentDbRound = await this.roundRepository.findById({
      value: roundId,
    });
    if (
      currentDbRound &&
      redisState.totalPoints !== currentDbRound.points.total
    ) {
      await this.roundRepository.updatePoints(
        { value: roundId },
        { total: redisState.totalPoints },
      );
    }
  }

  private async handleFinishedRound(
    roundId: string,
    redisState: RedisRoundState,
  ) {
    const now = new Date();
    const endAt = new Date(redisState.endAt);
    if (now > endAt) {
      await this.broadcastRoundFinished(roundId, redisState);
      await this.clearRoundData(roundId);
    }
  }

  private async broadcastRoundFinished(
    roundId: string,
    redisState: RedisRoundState,
  ) {
    const round = await this.roundRepository.findWithParticipants({
      value: roundId,
    });
    if (!round) return;

    const winner = round.getWinner();
    const winnerData = winner
      ? {
          username: winner.username,
          points: winner.points,
        }
      : null;

    this.websocketGateway.broadcastRoundFinished(roundId, {
      id: roundId,
      totalPoints: redisState.totalPoints,
      winner: winnerData,
    });
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
