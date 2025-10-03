import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../../types/user.types';
import { PrismaRoundRepository } from '../../../infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from '../../../infrastructure/persistence/redis-round.repository';
import { PrismaUserRepository } from '../../../infrastructure/persistence/prisma-user.repository';
import { ValidationUtil } from '../../users/validation.util';

@Injectable()
export class RoundCreationService {
  constructor(
    private readonly prismaRoundRepository: PrismaRoundRepository,
    private readonly redisRoundRepository: RedisRoundRepository,
    private readonly userRepository: PrismaUserRepository,
    private readonly cfg: ConfigService,
  ) {}

  /**
   * Создает новый раунд в БД и Redis
   */
  async create(
    creator: AuthenticatedUser,
  ): Promise<{ id: string; startAt: string; endAt: string }> {
    const timeRange = this.calculateRoundTimes();

    const domainCreator = await this.userRepository.findById({
      value: creator.id,
    });
    if (!domainCreator) {
      throw new BadRequestException('Creator not found');
    }

    const round = await this.prismaRoundRepository.create(timeRange);

    try {
      await this.redisRoundRepository.create(timeRange, round.id.value);
    } catch {
      await this.prismaRoundRepository.deleteById({ value: round.id.value });
      throw new BadRequestException('Failed to create round in Redis');
    }

    return {
      id: round.id.value,
      startAt: round.timeRange.startAt.toISOString(),
      endAt: round.timeRange.endAt.toISOString(),
    };
  }

  private calculateRoundTimes() {
    const now = new Date();
    const cooldownDuration = this.cfg.get('app.game.cooldownDuration');
    const roundDuration = this.cfg.get('app.game.roundDuration');
    const startAt = new Date(now.getTime() + cooldownDuration * 1000);
    const endAt = new Date(startAt.getTime() + roundDuration * 1000);

    ValidationUtil.validateRoundDates(startAt, endAt);

    return { startAt, endAt };
  }
}
