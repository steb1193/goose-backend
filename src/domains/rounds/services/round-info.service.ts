import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../../types/user.types';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from '../../../infrastructure/persistence/redis-round.repository';
import { PrismaUserRepository } from '../../../infrastructure/persistence/prisma-user.repository';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';
import { Round } from '../../rounds/entities/round.entity';

@Injectable()
export class RoundInfoService {
  constructor(
    private readonly prismaRoundRepository: PrismaRoundRepository,
    private readonly redisRoundRepository: RedisRoundRepository,
    private readonly userRepository: PrismaUserRepository,
    private readonly redisService: RedisConnectionService,
    private readonly cfg: ConfigService,
  ) {}

  /**
   * Получает информацию о конкретном раунде
   */
  async info(id: string, user: AuthenticatedUser) {
    const roundId = { value: id };
    const domainUser = await this.userRepository.findById({ value: user.id });

    if (!domainUser) {
      throw new NotFoundException('User not found');
    }

    let round = await this.redisRoundRepository.findById(roundId);

    if (!round) {
      round = await this.prismaRoundRepository.findWithParticipants(roundId);

      if (round && this.isRoundActive(round)) {
        await this.restoreRoundToRedis(round);
        round = await this.redisRoundRepository.findById(roundId);
      }
    }

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    const participant = round.getParticipant(user.id);

    const myPoints = domainUser.isNikita() ? 0 : participant?.points || 0;

    const winner = round.getWinner();

    const result = {
      id: round.id.value,
      startAt: round.timeRange.startAt.toISOString(),
      endAt: round.timeRange.endAt.toISOString(),
      totalPoints: round.points.total,
      status: round.status.value,
      myPoints,
      winner: winner
        ? {
            username: winner.username,
            points: winner.points,
          }
        : null,
      config: {
        cooldownDuration: this.cfg.get('app.game.cooldownDuration'),
        roundDuration: this.cfg.get('app.game.roundDuration'),
      },
    };

    return result;
  }

  private async restoreRoundToRedis(round: Round) {
    try {
      if (!this.isRoundActive(round)) {
        return;
      }

      await this.restoreRoundState(round);
      await this.restoreLeaderboard(round);
    } catch (error) {
      console.error(`Error restoring round ${round.id.value} to Redis:`, error);
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
    const leaderboard = {
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
