import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottleService {
  private readonly lastTapByUser = new Map<string, number>();

  shouldThrottle(roundId: string, userId: string, windowMs: number): boolean {
    const key = `${roundId}:${userId}`;
    const now = Date.now();
    const last = this.lastTapByUser.get(key) ?? 0;

    if (now - last < windowMs) {
      return true;
    }

    this.lastTapByUser.set(key, now);
    return false;
  }

  clearThrottle(roundId: string, userId: string): void {
    const key = `${roundId}:${userId}`;
    this.lastTapByUser.delete(key);
  }

  clearAllThrottles(): void {
    this.lastTapByUser.clear();
  }
}
