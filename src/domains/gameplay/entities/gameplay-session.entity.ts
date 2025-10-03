import { User } from '../../users/entities/user.entity';
import { Round } from '../../rounds/entities/round.entity';

export interface TapResult {
  success: boolean;
  myPoints: number;
  myTaps: number;
  timestamp: Date;
  error?: string;
}

export interface ThrottleConfig {
  windowMs: number;
  maxTapsPerWindow: number;
}

export class GameplaySession {
  constructor(
    public readonly user: User,
    public readonly round: Round,
    public readonly taps: number = 0,
    public readonly lastTapAt: Date | null = null,
  ) {}

  /**
   * Проверка можно ли сделать тап
   */
  canTap(now: Date = new Date()): boolean {
    return this.round.isActive(now);
  }

  /**
   * Проверка троттлинга
   */
  isThrottled(config: ThrottleConfig, now: Date = new Date()): boolean {
    if (!this.lastTapAt) {
      return false;
    }

    const timeSinceLastTap = now.getTime() - this.lastTapAt.getTime();
    return timeSinceLastTap < config.windowMs;
  }

  /**
   * Выполнение тапа
   */
  performTap(now: Date = new Date()): TapResult {
    if (!this.canTap(now)) {
      return {
        success: false,
        myPoints: 0,
        myTaps: this.taps,
        timestamp: now,
        error: 'Round not active or user cannot participate',
      };
    }

    const newTaps = this.taps + 1;
    const pointsGained = this.user.calculatePoints(newTaps);
    const newPoints = this.user.isNikita() ? 0 : pointsGained;

    return {
      success: true,
      myPoints: newPoints,
      myTaps: newTaps,
      timestamp: now,
    };
  }

  /**
   * Получение текущих очков пользователя
   */
  getCurrentPoints(): number {
    if (this.user.isNikita()) {
      return 0;
    }

    return this.user.calculatePoints(this.taps);
  }
}
