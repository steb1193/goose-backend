import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GooseRoundsService } from './rounds.service';
import { RoundsController } from './rounds.controller';
import { RoundListService } from './services/round-list.service';
import { RoundCreationService } from './services/round-creation.service';
import { RoundInfoService } from './services/round-info.service';
import { RoundTapService } from './services/round-tap.service';
import { GooseAuthService } from '../users/auth.service';
import { JwtCookieGuard } from '../users/jwt-cookie.guard';
import { GameplayDomainService } from '../gameplay/services/gameplay-domain.service';
import { PrismaRoundRepository } from '../../infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from '../../infrastructure/persistence/redis-round.repository';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma-user.repository';
import { RedisGameplayRepository } from '../../infrastructure/persistence/redis-gameplay.repository';
import { PrismaService } from '../../prisma.service';
import { RedisConnectionService } from '../../infrastructure/redis/redis-connection.service';
import { RedisPubSubService } from '../../infrastructure/redis/redis-pubsub.service';
import { WebSocketModule } from '../../infrastructure/websocket/websocket.module';
import { GooseWebSocketGateway } from '../../infrastructure/websocket/websocket.gateway';
import { SyncService } from './services/sync.service';
import { RoundRecoveryService } from './services/round-recovery.service';
import { RoundStatusService } from './services/round-status.service';
import { RoundSyncService } from './services/round-sync.service';
import { RoundCleanupService } from './services/round-cleanup.service';
import {
  ROUND_REPOSITORY,
  USER_REPOSITORY,
  GAMEPLAY_REPOSITORY,
} from '../domain.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    WebSocketModule,
  ],
  controllers: [RoundsController],
  providers: [
    PrismaService,
    RedisConnectionService,
    RedisPubSubService,
    GooseWebSocketGateway,
    GooseRoundsService,
    RoundListService,
    RoundCreationService,
    RoundInfoService,
    RoundTapService,
    GooseAuthService,
    JwtCookieGuard,
    GameplayDomainService,
    PrismaRoundRepository,
    RedisRoundRepository,
    PrismaUserRepository,
    RedisGameplayRepository,
    SyncService,
    RoundRecoveryService,
    RoundStatusService,
    RoundSyncService,
    RoundCleanupService,
    { provide: ROUND_REPOSITORY, useClass: PrismaRoundRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: GAMEPLAY_REPOSITORY, useClass: RedisGameplayRepository },
  ],
  exports: [GooseRoundsService],
})
export class RoundsModule {}
