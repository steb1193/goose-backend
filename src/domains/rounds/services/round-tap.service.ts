import { Injectable, BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../types/user.types';
import { GameplayDomainService } from '../../gameplay/services/gameplay-domain.service';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from '../../../infrastructure/persistence/redis-round.repository';
import { PrismaUserRepository } from '../../../infrastructure/persistence/prisma-user.repository';
import { RedisGameplayRepository } from '../../../infrastructure/persistence/redis-gameplay.repository';
import { ValidationUtil } from '../../users/validation.util';

@Injectable()
export class RoundTapService {
  constructor(
    private readonly gameplayDomainService: GameplayDomainService,
    private readonly prismaRoundRepository: PrismaRoundRepository,
    private readonly redisRoundRepository: RedisRoundRepository,
    private readonly userRepository: PrismaUserRepository,
    private readonly gameplayRepository: RedisGameplayRepository,
  ) {}

  /**
   * Обрабатывает тап пользователя в раунде
   */
  async tap(roundId: string, user: AuthenticatedUser) {
    ValidationUtil.validateRoundId(roundId);

    const domainUser = await this.userRepository.findById({ value: user.id });
    if (!domainUser) {
      throw new BadRequestException('User not found');
    }

    const round = await this.redisRoundRepository.findById({ value: roundId });
    if (!round) {
      throw new BadRequestException('Round not found or not active');
    }

    const now = new Date();
    if (now < round.timeRange.startAt) {
      throw new BadRequestException('Round has not started yet');
    }
    if (now > round.timeRange.endAt) {
      throw new BadRequestException('Round has already finished');
    }

    const tapResult = await this.gameplayDomainService.performTap(
      domainUser,
      round,
    );

    if (!tapResult.success) {
      throw new BadRequestException(tapResult.error || 'Tap failed');
    }

    await this.redisRoundRepository.updateParticipantStats(
      { value: roundId },
      user.id,
      tapResult.myTaps,
      tapResult.myPoints,
    );

    await this.redisRoundRepository.updatePoints(
      { value: roundId },
      { total: round.points.total },
    );

    return {
      taps: tapResult.myTaps,
      points: tapResult.myPoints,
      totalPoints: round.points.total,
    };
  }
}
