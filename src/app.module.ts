import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthModule } from './domains/users/auth.module';
import { RoundsModule } from './domains/rounds/rounds.module';
import { WebSocketModule } from './infrastructure/websocket/websocket.module';
import { CommonServicesModule } from './common/services/common-services.module';
import { RedisConnectionService } from './infrastructure/redis/redis-connection.service';
import { RedisPubSubService } from './infrastructure/redis/redis-pubsub.service';
import { WebSocketConnectionService } from './infrastructure/websocket/websocket-connection.service';
import { WebSocketBroadcastService } from './infrastructure/websocket/websocket-broadcast.service';
import { GooseWebSocketGateway } from './infrastructure/websocket/websocket.gateway';
import { PrismaRoundRepository } from './infrastructure/persistence/prisma-round.repository';
import { RedisRoundRepository } from './infrastructure/persistence/redis-round.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { RedisGameplayRepository } from './infrastructure/persistence/redis-gameplay.repository';
import { GameplayDomainService } from './domains/gameplay/services/gameplay-domain.service';
import {
  ROUND_REPOSITORY,
  USER_REPOSITORY,
  GAMEPLAY_REPOSITORY,
} from './domains/domain.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    RoundsModule,
    WebSocketModule,
    CommonServicesModule,
  ],
  providers: [
    PrismaService,
    RedisConnectionService,
    RedisPubSubService,
    WebSocketConnectionService,
    WebSocketBroadcastService,
    GooseWebSocketGateway,
    PrismaRoundRepository,
    RedisRoundRepository,
    PrismaUserRepository,
    RedisGameplayRepository,
    GameplayDomainService,
    { provide: ROUND_REPOSITORY, useClass: PrismaRoundRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: GAMEPLAY_REPOSITORY, useClass: RedisGameplayRepository },
  ],
  exports: [
    PrismaService,
    RedisConnectionService,
    RedisPubSubService,
    WebSocketConnectionService,
    WebSocketBroadcastService,
    GooseWebSocketGateway,
    PrismaRoundRepository,
    RedisRoundRepository,
    PrismaUserRepository,
    RedisGameplayRepository,
    GameplayDomainService,
    ROUND_REPOSITORY,
    USER_REPOSITORY,
    GAMEPLAY_REPOSITORY,
  ],
})
export class AppModule {}
