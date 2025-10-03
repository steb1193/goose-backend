import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../types/user.types';
import { RoundListService } from './services/round-list.service';
import { RoundCreationService } from './services/round-creation.service';
import { RoundInfoService } from './services/round-info.service';
import { RoundTapService } from './services/round-tap.service';
import { RedisRoundRepository } from '../../infrastructure/persistence/redis-round.repository';
import { PrismaRoundRepository } from '../../infrastructure/persistence/prisma-round.repository';
import { RedisLeaderboard } from '../../infrastructure/persistence/redis-round.repository';

@Injectable()
export class GooseRoundsService {
  constructor(
    private readonly listService: RoundListService,
    private readonly creationService: RoundCreationService,
    private readonly infoService: RoundInfoService,
    private readonly tapService: RoundTapService,
    private readonly redisRoundRepository: RedisRoundRepository,
    private readonly prismaRoundRepository: PrismaRoundRepository,
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
    return await this.listService.list(after, limit);
  }

  /**
   * Создает новый раунд в БД и Redis
   */
  async create(
    creator: AuthenticatedUser,
  ): Promise<{ id: string; startAt: string; endAt: string }> {
    return await this.creationService.create(creator);
  }

  /**
   * Получает информацию о конкретном раунде
   */
  async info(id: string, user: AuthenticatedUser) {
    return await this.infoService.info(id, user);
  }

  /**
   * Обрабатывает тап пользователя в раунде
   */
  async tap(roundId: string, user: AuthenticatedUser) {
    return await this.tapService.tap(roundId, user);
  }

  /**
   * Получает leaderboard раунда
   */
  async getLeaderboard(roundId: string): Promise<RedisLeaderboard> {
    let leaderboard = await this.redisRoundRepository.getLeaderboard({
      value: roundId,
    });

    if (!leaderboard) {
      const round = await this.prismaRoundRepository.findWithParticipants({
        value: roundId,
      });

      if (!round) {
        throw new Error('Round not found');
      }

      leaderboard = {
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

    return leaderboard;
  }
}
