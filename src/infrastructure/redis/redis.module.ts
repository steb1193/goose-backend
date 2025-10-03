import { Module } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';
import { RedisPubSubService } from './redis-pubsub.service';

@Module({
  providers: [RedisConnectionService, RedisPubSubService],
  exports: [RedisConnectionService, RedisPubSubService],
})
export class RedisModule {}
