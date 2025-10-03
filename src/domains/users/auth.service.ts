import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma-user.repository';
import * as bcrypt from 'bcryptjs';
import type { UserRole, PublicUser } from '../../types/user.types';

export type JwtPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

@Injectable()
export class GooseAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userRepository: PrismaUserRepository,
  ) {}

  private determineRole(username: string): UserRole {
    switch (username) {
      case 'admin':
      case 'admin2':
      case 'admin3':
      case 'admin4':
        return 'admin';
      case 'nikita':
        return 'nikita';
      default:
        return 'survivor';
    }
  }

  async loginOrRegister(username: string, password: string) {
    let user = await this.userRepository.findByUsername(username);

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const role = this.determineRole(username);

      const prismaUser = await this.prisma.user.create({
        data: { username, password: hashedPassword, role },
      });

      user = await this.userRepository.findById({ value: prismaUser.id });
      if (!user) throw new UnauthorizedException('Failed to create user');
    } else {
      const prismaUser = await this.prisma.user.findUnique({
        where: { username: user.username.value },
      });

      if (
        !prismaUser ||
        !(await bcrypt.compare(password, prismaUser.password))
      ) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const payload: JwtPayload = {
      sub: user.id.value,
      username: user.username.value,
      role: user.role.value,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id.value,
        username: user.username.value,
        role: user.role.value,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.userRepository.findById({ value: payload.sub });
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id.value,
      username: user.username.value,
      role: user.role.value,
    };
  }
}
