import {
  Round,
  RoundId,
  RoundTimeRange,
  RoundPoints,
} from '../entities/round.entity';

export interface RoundRepository {
  /**
   * Создание нового раунда
   */
  create(timeRange: RoundTimeRange, id?: string): Promise<Round>;

  /**
   * Получение раунда по ID
   */
  findById(id: RoundId): Promise<Round | null>;

  /**
   * Получение всех раундов
   */
  listRounds(): Promise<Round[]>;

  /**
   * Обновление очков раунда
   */
  updatePoints(id: RoundId, points: RoundPoints): Promise<void>;

  /**
   * Удаление раунда по ID
   */
  deleteById(id: RoundId): Promise<void>;

  /**
   * Обновление статистики участника
   */
  updateParticipantStats(
    roundId: RoundId,
    userId: string,
    taps: number,
    points: number,
  ): Promise<void>;

  /**
   * Получение детальной информации о раунде
   */
  findWithParticipants(id: RoundId): Promise<Round | null>;
}
