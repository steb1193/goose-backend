import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtCookieGuard } from '../users/jwt-cookie.guard';
import { GooseRoundsService } from './rounds.service';
import { ValidationUtil } from '../users/validation.util';
import { WebSocketBroadcastService } from '../../infrastructure/websocket/websocket-broadcast.service';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../types/user.types';

@Controller('rounds')
export class RoundsController {
  constructor(
    private readonly svc: GooseRoundsService,
    private readonly cfg: ConfigService,
    private readonly websocketBroadcast: WebSocketBroadcastService,
  ) {}

  /**
   * Получает список раундов с пагинацией
   */
  @Get()
  async list(@Query('after') after?: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return await this.svc.list(after, limitNum);
  }

  /**
   * Создает новый раунд (только для админов)
   */
  @Post()
  @UseGuards(JwtCookieGuard)
  async create(
    @Req()
    req: Request & {
      user: AuthenticatedUser;
    },
  ) {
    if (req.user.role !== 'admin') throw new BadRequestException('forbidden');

    const round = await this.svc.create(req.user);

    this.websocketBroadcast.broadcastRoundUpdate(round.id, {
      id: round.id,
      startAt: round.startAt,
      endAt: round.endAt,
      totalPoints: 0,
      status: 'cooldown',
    });

    return { data: round };
  }

  /**
   * Получает информацию о конкретном раунде
   */
  @Get(':id')
  @UseGuards(JwtCookieGuard)
  async info(
    @Param('id') id: string,
    @Req()
    req: Request & {
      user: AuthenticatedUser;
    },
  ) {
    ValidationUtil.validateRoundId(id);
    return await this.svc.info(id, req.user);
  }
}
