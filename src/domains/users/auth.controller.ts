import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { GooseAuthService } from './auth.service';
import { JwtCookieGuard } from './jwt-cookie.guard';
import { CookieService } from '../../common/services/cookie.service';
import { ValidationUtil } from './validation.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: GooseAuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Res() res: Response,
  ) {
    ValidationUtil.validateUsername(body.username);
    if (!body.password || body.password.trim() === '') {
      throw new BadRequestException('Password is required');
    }
    const result = await this.authService.loginOrRegister(
      body.username,
      body.password,
    );
    this.cookieService.setAuthCookie(res, result.access_token);
    return res.json({ user: result.user });
  }

  @Get('me')
  @UseGuards(JwtCookieGuard)
  me(@Req() req: Request) {
    return { data: req.user };
  }

  @Post('logout')
  @UseGuards(JwtCookieGuard)
  logout(@Res() res: Response) {
    this.cookieService.clearAuthCookie(res);
    return res.json({ ok: true });
  }
}
