export interface RoundId {
  value: string;
}

export interface RoundStatus {
  value: 'cooldown' | 'active' | 'finished';
}

export interface RoundTimeRange {
  startAt: Date;
  endAt: Date;
}

export interface RoundPoints {
  total: number;
}

export interface RoundParticipant {
  userId: string;
  username: string;
  taps: number;
  points: number;
}

export class Round {
  constructor(
    public readonly id: RoundId,
    public readonly timeRange: RoundTimeRange,
    public readonly points: RoundPoints,
    public readonly participants: RoundParticipant[],
    public readonly status: RoundStatus,
  ) {}

  /**
   * Создание раунда из данных персистентности
   */
  static fromPersistence(data: {
    id: string;
    startAt: Date;
    endAt: Date;
    totalPoints: number;
    participants: RoundParticipant[];
  }): Round {
    const id: RoundId = { value: data.id };
    const timeRange: RoundTimeRange = {
      startAt: data.startAt,
      endAt: data.endAt,
    };
    const points: RoundPoints = { total: data.totalPoints };
    const status = Round.calculateStatus(timeRange);

    return new Round(id, timeRange, points, data.participants, status);
  }

  /**
   * Определение статуса раунда по времени
   */
  static calculateStatus(
    timeRange: RoundTimeRange,
    now: Date = new Date(),
  ): RoundStatus {
    if (now < timeRange.startAt) {
      return { value: 'cooldown' };
    }
    if (now > timeRange.endAt) {
      return { value: 'finished' };
    }
    return { value: 'active' };
  }

  /**
   * Проверка активности раунда
   */
  isActive(now: Date = new Date()): boolean {
    return now >= this.timeRange.startAt && now <= this.timeRange.endAt;
  }

  /**
   * Проверка завершения раунда
   */
  isFinished(now: Date = new Date()): boolean {
    return now > this.timeRange.endAt;
  }

  /**
   * Получение победителя раунда
   */
  getWinner(): RoundParticipant | null {
    if (this.status.value !== 'finished' || this.participants.length === 0) {
      return null;
    }

    return this.participants.reduce((winner, participant) =>
      participant.points > winner.points ? participant : winner,
    );
  }

  /**
   * Получение участника по ID
   */
  getParticipant(userId: string): RoundParticipant | null {
    return this.participants.find((p) => p.userId === userId) || null;
  }

  /**
   * Создание лидерборда
   */
  createLeaderboard(): RoundParticipant[] {
    return [...this.participants].sort((a, b) => b.points - a.points);
  }
}
