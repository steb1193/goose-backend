import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from '../../../infrastructure/persistence/redis-round.repository';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';
import { Round } from '../../rounds/entities/round.entity';
import { RedisLeaderboard } from '../../../infrastructure/persistence/redis-round.repository';

@Injectable()
export class RoundListService {
  constructor(
    private readonly prismaRoundRepository: PrismaRoundRepository,
    private readonly redisRoundRepository: RedisRoundRepository,
    private readonly redisService: RedisConnectionService,
    private readonly cfg: ConfigService,
  ) {}

  /**
   * Получает список раундов с курсорной пагинацией
   */
  async list(
    after?: string,
    limit: number = 20,
  ): Promise<{
    data: Array<{
      id: string;
      startAt: string;
      endAt: string;
      totalPoints: number;
      status: string;
    }>;
    hasMore: boolean;
    config: {
      cooldownDuration: number;
      roundDuration: number;
    };
  }> {
    const activeRounds = await this.redisRoundRepository.listRounds();

    if (activeRounds.length === 0) {
      await this.recoverActiveRoundsFromDatabase();
      const recoveredRounds = await this.redisRoundRepository.listRounds();
      activeRounds.push(...recoveredRounds);
    }

    const finishedRounds = await this.prismaRoundRepository.listRounds();

    const allRounds = [...activeRounds, ...finishedRounds];
    const uniqueRounds = allRounds.filter(
      (round, index, self) =>
        index === self.findIndex((r) => r.id.value === round.id.value),
    );

    const sortedRounds = uniqueRounds.sort(
      (a, b) => b.timeRange.startAt.getTime() - a.timeRange.startAt.getTime(),
    );

    let startIndex = 0;
    if (after) {
      const afterIndex = sortedRounds.findIndex(
        (round) => round.id.value === after,
      );
      if (afterIndex !== -1) {
        startIndex = afterIndex + 1;
      }
    }

    const paginatedRounds = sortedRounds.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sortedRounds.length;

    const now = new Date();
    const cooldownDuration = this.cfg.get('app.game.cooldownDuration');
    const roundDuration = this.cfg.get('app.game.roundDuration');

    return {
      data: paginatedRounds.map((round) => ({
        id: round.id.value,
        startAt: round.timeRange.startAt.toISOString(),
        endAt: round.timeRange.endAt.toISOString(),
        totalPoints: round.points.total,
        status:
          now < round.timeRange.startAt
            ? 'cooldown'
            : now > round.timeRange.endAt
              ? 'finished'
              : 'active',
      })),
      hasMore,
      config: {
        cooldownDuration,
        roundDuration,
      },
    };
  }

  private async recoverActiveRoundsFromDatabase() {
    try {
      const activeRounds =
        await this.prismaRoundRepository.findActiveOrUpcomingRounds();

      for (const round of activeRounds) {
        if (!this.isRoundActive(round)) {
          continue;
        }

        await this.restoreRoundState(round);
        await this.restoreLeaderboard(round);
      }
    } catch (error) {
      console.error('Error recovering active rounds from database:', error);
    }
  }

  private isRoundActive(round: Round): boolean {
    const now = new Date();
    return now <= round.timeRange.endAt;
  }

  private async restoreRoundState(round: Round) {
    const now = new Date();
    const roundState = {
      id: round.id.value,
      startAt: round.timeRange.startAt.toISOString(),
      endAt: round.timeRange.endAt.toISOString(),
      totalPoints: round.points.total,
      status: round.status.value,
      participants: round.participants.map((p) => p.userId),
      lastUpdate: now.toISOString(),
    };

    await this.redisService.set(
      `round:${round.id.value}:state`,
      JSON.stringify(roundState),
    );

    await this.redisService.sadd('active_rounds', round.id.value);
  }

  private async restoreLeaderboard(round: Round) {
    const leaderboard: RedisLeaderboard = {
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

    await this.redisService.set(
      `round:${round.id.value}:leaderboard`,
      JSON.stringify(leaderboard),
      3600,
    );
  }
}
