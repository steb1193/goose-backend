import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { APP_CONSTANTS } from '../constants/app.constants';

@Injectable()
export class CookieService {
  setAuthCookie(res: Response, token: string): void {
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: APP_CONSTANTS.COOKIE_MAX_AGE,
    });
  }

  clearAuthCookie(res: Response): void {
    res.clearCookie('token');
  }
}
