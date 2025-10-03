import { Injectable, Inject } from '@nestjs/common';
import {
  GameplaySession,
  TapResult,
  ThrottleConfig,
} from '../entities/gameplay-session.entity';
import type { GameplayRepository } from '../repositories/gameplay.repository';
import type { User, UserId } from '../../users/entities/user.entity';
import type { Round, RoundId } from '../../rounds/entities/round.entity';
import { GAMEPLAY_REPOSITORY } from '../../domain.module';

@Injectable()
export class GameplayDomainService {
  constructor(
    @Inject(GAMEPLAY_REPOSITORY)
    private readonly gameplayRepository: GameplayRepository,
  ) {}

  /**
   * Выполнение тапа пользователем
   */
  async performTap(
    user: User,
    round: Round,
    throttleConfig: ThrottleConfig = { windowMs: 50, maxTapsPerWindow: 1 },
  ): Promise<TapResult> {
    const userId = user.id;
    const roundId = round.id;

    let session = await this.gameplayRepository.findSession(userId, roundId);
    if (!session) {
      session = await this.gameplayRepository.createSession(userId, roundId);
    }

    const lastTapTime = await this.gameplayRepository.getLastTapTime(
      userId,
      roundId,
    );
    if (lastTapTime) {
      const now = new Date();
      const timeSinceLastTap = now.getTime() - lastTapTime.getTime();
      if (timeSinceLastTap < throttleConfig.windowMs) {
        return {
          success: false,
          myPoints: session.getCurrentPoints(),
          myTaps: session.taps,
          timestamp: now,
          error: 'Too many taps',
        };
      }
    }

    const tapResult = session.performTap();

    if (tapResult.success) {
      await this.gameplayRepository.updateLastTapTime(
        userId,
        roundId,
        tapResult.timestamp,
      );

      const updatedSession = new GameplaySession(
        user,
        round,
        tapResult.myTaps,
        tapResult.timestamp,
      );
      await this.gameplayRepository.updateSession(updatedSession);
    }

    return tapResult;
  }

  /**
   * Получение сессии геймплея
   */
  async getSession(
    userId: UserId,
    roundId: RoundId,
  ): Promise<GameplaySession | null> {
    return this.gameplayRepository.findSession(userId, roundId);
  }

  /**
   * Создание новой сессии геймплея
   */
  async createSession(
    userId: UserId,
    roundId: RoundId,
  ): Promise<GameplaySession> {
    return this.gameplayRepository.createSession(userId, roundId);
  }

  /**
   * Очистка сессии геймплея
   */
  async clearSession(userId: UserId, roundId: RoundId): Promise<void> {
    await this.gameplayRepository.clearSession(userId, roundId);
  }

  /**
   * Получение статистики пользователя в раунде
   */
  async getUserStats(
    userId: UserId,
    roundId: RoundId,
  ): Promise<{
    taps: number;
    points: number;
    lastTapAt: Date | null;
  }> {
    const session = await this.gameplayRepository.findSession(userId, roundId);
    const lastTapTime = await this.gameplayRepository.getLastTapTime(
      userId,
      roundId,
    );

    return {
      taps: session?.taps || 0,
      points: session?.getCurrentPoints() || 0,
      lastTapAt: lastTapTime,
    };
  }
}
