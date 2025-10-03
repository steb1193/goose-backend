import { Module } from '@nestjs/common';
import { RedisConnectionService } from './redis/redis-connection.service';
import { WebSocketConnectionService } from './websocket/websocket-connection.service';
import { WebSocketBroadcastService } from './websocket/websocket-broadcast.service';
import { PrismaRoundRepository } from './persistence/prisma-round.repository';
import { PrismaUserRepository } from './persistence/prisma-user.repository';
import { RedisGameplayRepository } from './persistence/redis-gameplay.repository';

@Module({
  providers: [
    RedisConnectionService,
    WebSocketConnectionService,
    WebSocketBroadcastService,
    PrismaRoundRepository,
    PrismaUserRepository,
    RedisGameplayRepository,
  ],
  exports: [
    RedisConnectionService,
    WebSocketConnectionService,
    WebSocketBroadcastService,
    PrismaRoundRepository,
    PrismaUserRepository,
    RedisGameplayRepository,
  ],
})
export class InfrastructureModule {}
