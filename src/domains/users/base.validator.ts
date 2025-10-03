import { BadRequestException } from '@nestjs/common';

export abstract class BaseValidator {
  protected static validateString(
    value: unknown,
    fieldName: string,
    minLength?: number,
    maxLength?: number,
    pattern?: RegExp,
  ): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (minLength && value.length < minLength) {
      throw new BadRequestException(
        `${fieldName} must be at least ${minLength} characters`,
      );
    }

    if (maxLength && value.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} must be at most ${maxLength} characters`,
      );
    }

    if (pattern && !pattern.test(value)) {
      throw new BadRequestException(`Invalid ${fieldName} format`);
    }

    return value;
  }

  protected static validateDate(value: unknown, fieldName: string): Date {
    if (!value) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const date = new Date(value as string);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName} format`);
    }

    return date;
  }

  protected static validateUuid(value: unknown, fieldName: string): string {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return this.validateString(
      value,
      fieldName,
      undefined,
      undefined,
      uuidPattern,
    );
  }
}
