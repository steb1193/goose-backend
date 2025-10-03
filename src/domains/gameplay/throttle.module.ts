import { Module } from '@nestjs/common';
import { ThrottleService } from './services/throttle.service';

@Module({
  providers: [ThrottleService],
  exports: [ThrottleService],
})
export class ThrottleModule {}
