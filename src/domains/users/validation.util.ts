import { BaseValidator } from './base.validator';
import { APP_CONSTANTS } from '../../common/constants/app.constants';

export class ValidationUtil extends BaseValidator {
  static validateUsername(username: string): string {
    return this.validateString(
      username,
      'Username',
      APP_CONSTANTS.MIN_USERNAME_LENGTH,
      APP_CONSTANTS.MAX_USERNAME_LENGTH,
      /^[a-zA-Zа-яА-Я0-9_]+$/,
    );
  }

  static validatePassword(password: string): string {
    return this.validateString(
      password,
      'Password',
      APP_CONSTANTS.MIN_PASSWORD_LENGTH,
    );
  }

  static validateRoundDates(startAt: Date, endAt: Date): void {

    if (endAt <= startAt) {
      throw new Error('Round end time must be after start time');
    }

    const duration = endAt.getTime() - startAt.getTime();
    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours

    if (duration > maxDuration) {
      throw new Error('Round duration cannot exceed 24 hours');
    }
  }

  static validateRoundId(roundId: string): string {
    return this.validateString(
      roundId,
      'Round ID',
      undefined,
      undefined,
      /^[a-zA-Z0-9_-]+$/,
    );
  }
}
