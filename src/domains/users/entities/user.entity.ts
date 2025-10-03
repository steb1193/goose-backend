export interface UserId {
  value: string;
}

export interface Username {
  value: string;
}

export interface UserPassword {
  value: string;
}

export interface UserRole {
  value: 'admin' | 'survivor' | 'nikita';
}

export class User {
  constructor(
    public readonly id: UserId,
    public readonly username: Username,
    public readonly password: UserPassword,
    public readonly role: UserRole,
  ) {}

  /**
   * Проверка является ли пользователь Никитой
   */
  isNikita(): boolean {
    return (
      this.role.value === 'nikita' ||
      this.username.value.toLowerCase() === 'nikita'
    );
  }

  /**
   * Проверка является ли пользователь админом
   */
  isAdmin(): boolean {
    return this.role.value === 'admin';
  }

  /**
   * Проверка может ли пользователь создавать раунды
   */
  canCreateRounds(): boolean {
    return this.isAdmin();
  }

  /**
   * Рассчитывает очки пользователя за количество тапов
   * Система очков: каждый тап = +1 очко, каждый 11-й тап = +10 очков (бонус)
   * Возвращает 0 для пользователя "Никита"
   */
  calculatePoints(taps: number): number {
    if (this.isNikita()) {
      return 0;
    }

    if (taps === 0) {
      return 0;
    }

    const basePoints = this.calculateBasePoints(taps);
    const bonusPoints = this.calculateBonusPoints(taps);

    return basePoints + bonusPoints;
  }

  /**
   * Рассчитывает базовые очки (1 очко за тап)
   */
  private calculateBasePoints(taps: number): number {
    return taps;
  }

  /**
   * Рассчитывает бонусные очки (каждый 11-й тап дает +9 очков)
   */
  private calculateBonusPoints(taps: number): number {
    const bonusTaps = Math.floor(taps / 11);
    return bonusTaps * 9;
  }
}
