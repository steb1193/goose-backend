import { GameplaySession } from '../entities/gameplay-session.entity';
import { UserId } from '../../users/entities/user.entity';
import { RoundId } from '../../rounds/entities/round.entity';

export interface GameplayRepository {
  /**
   * Получение сессии геймплея
   */
  findSession(
    userId: UserId,
    roundId: RoundId,
  ): Promise<GameplaySession | null>;

  /**
   * Создание новой сессии геймплея
   */
  createSession(userId: UserId, roundId: RoundId): Promise<GameplaySession>;

  /**
   * Обновление сессии геймплея
   */
  updateSession(session: GameplaySession): Promise<void>;

  /**
   * Получение времени последнего тапа
   */
  getLastTapTime(userId: UserId, roundId: RoundId): Promise<Date | null>;

  /**
   * Обновление времени последнего тапа
   */
  updateLastTapTime(
    userId: UserId,
    roundId: RoundId,
    timestamp: Date,
  ): Promise<void>;

  /**
   * Очистка данных сессии
   */
  clearSession(userId: UserId, roundId: RoundId): Promise<void>;
}
