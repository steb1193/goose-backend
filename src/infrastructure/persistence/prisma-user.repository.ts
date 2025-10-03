import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { User, UserId } from '../../domains/users/entities/user.entity';
import { UserRepository } from '../../domains/users/repositories/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: UserId): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: id.value },
    });

    if (!user) return null;
    return this.mapToDomain(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { username },
    });

    if (!user) return null;
    return this.mapToDomain(user);
  }

  async create(
    username: string,
    role: 'admin' | 'survivor' | 'nikita',
    password: string,
  ): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        username,
        role,
        password,
      },
    });

    return this.mapToDomain(user);
  }

  async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id.value },
      data: {
        username: user.username.value,
        password: user.password.value,
        role: user.role.value,
      },
    });
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { username: 'asc' },
    });

    return users.map((user) => this.mapToDomain(user));
  }

  async exists(id: UserId): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: id.value },
    });

    return count > 0;
  }

  private mapToDomain(prismaUser: {
    id: string;
    username: string;
    password: string;
    role: string;
  }): User {
    return new User(
      { value: prismaUser.id },
      { value: prismaUser.username },
      { value: prismaUser.password },
      { value: prismaUser.role as 'admin' | 'survivor' | 'nikita' },
    );
  }
}
