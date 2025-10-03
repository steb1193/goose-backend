import { Injectable, Inject } from '@nestjs/common';
import { RedisConnectionService } from '../redis/redis-connection.service';
import { GameplaySession } from '../../domains/gameplay/entities/gameplay-session.entity';
import { GameplayRepository } from '../../domains/gameplay/repositories/gameplay.repository';
import { UserId } from '../../domains/users/entities/user.entity';
import { RoundId } from '../../domains/rounds/entities/round.entity';
import { USER_REPOSITORY } from '../../domains/domain.module';
import { RedisRoundRepository } from './redis-round.repository';
import type { UserRepository } from '../../domains/users/repositories/user.repository';

@Injectable()
export class RedisGameplayRepository implements GameplayRepository {
  constructor(
    private readonly redis: RedisConnectionService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly redisRoundRepository: RedisRoundRepository,
  ) {}

  async findSession(
    userId: UserId,
    roundId: RoundId,
  ): Promise<GameplaySession | null> {
    const tapsKey = `round:${roundId.value}:user:${userId.value}:taps`;
    const lastTapKey = `round:${roundId.value}:user:${userId.value}:last_tap`;

    const tapsStr = await this.redis.get(tapsKey);
    const lastTapStr = await this.redis.get(lastTapKey);

    if (!tapsStr) return null;

    const taps = parseInt(tapsStr, 10) || 0;
    const lastTapAt = lastTapStr ? new Date(parseInt(lastTapStr, 10)) : null;

    const user = await this.userRepository.findById(userId);
    const round = await this.redisRoundRepository.findById(roundId);

    if (!user || !round) return null;

    return new GameplaySession(user, round, taps, lastTapAt);
  }

  async createSession(
    userId: UserId,
    roundId: RoundId,
  ): Promise<GameplaySession> {
    const tapsKey = `round:${roundId.value}:user:${userId.value}:taps`;
    await this.redis.set(tapsKey, '0');

    const user = await this.userRepository.findById(userId);
    const round = await this.redisRoundRepository.findById(roundId);

    if (!user || !round) {
      throw new Error('User or Round not found');
    }

    return new GameplaySession(user, round, 0, null);
  }

  async updateSession(session: GameplaySession): Promise<void> {
    const tapsKey = `round:${session.round.id.value}:user:${session.user.id.value}:taps`;
    await this.redis.set(tapsKey, session.taps.toString());
  }

  async getLastTapTime(userId: UserId, roundId: RoundId): Promise<Date | null> {
    const lastTapKey = `round:${roundId.value}:user:${userId.value}:last_tap`;
    const lastTapStr = await this.redis.get(lastTapKey);

    return lastTapStr ? new Date(parseInt(lastTapStr, 10)) : null;
  }

  async updateLastTapTime(
    userId: UserId,
    roundId: RoundId,
    timestamp: Date,
  ): Promise<void> {
    const lastTapKey = `round:${roundId.value}:user:${userId.value}:last_tap`;
    await this.redis.set(lastTapKey, timestamp.getTime().toString(), 10); // TTL 10 секунд
  }

  async clearSession(userId: UserId, roundId: RoundId): Promise<void> {
    const tapsKey = `round:${roundId.value}:user:${userId.value}:taps`;
    const lastTapKey = `round:${roundId.value}:user:${userId.value}:last_tap`;

    await this.redis.del(tapsKey);
    await this.redis.del(lastTapKey);
  }
}
