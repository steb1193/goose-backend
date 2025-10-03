import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GooseAuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CommonServicesModule } from '../../common/services/common-services.module';
import { PrismaService } from '../../prisma.service';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma-user.repository';
import { USER_REPOSITORY } from '../domain.module';

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
    CommonServicesModule,
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    GooseAuthService,
    PrismaUserRepository,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
  exports: [GooseAuthService],
})
export class AuthModule {}
