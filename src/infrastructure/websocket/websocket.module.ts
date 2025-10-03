import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSocketConnectionService } from './websocket-connection.service';
import { WebSocketBroadcastService } from './websocket-broadcast.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
  ],
  providers: [WebSocketConnectionService, WebSocketBroadcastService],
  exports: [WebSocketConnectionService, WebSocketBroadcastService, RedisModule],
})
export class WebSocketModule {}
