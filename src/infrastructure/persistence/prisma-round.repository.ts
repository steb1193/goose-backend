import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  Round,
  RoundId,
  RoundTimeRange,
  RoundPoints,
} from '../../domains/rounds/entities/round.entity';
import { RoundRepository } from '../../domains/rounds/repositories/round.repository';

@Injectable()
export class PrismaRoundRepository implements RoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создает новый раунд в базе данных
   */
  async create(timeRange: RoundTimeRange, id?: string): Promise<Round> {
    const round = await this.prisma.round.create({
      data: {
        id: id,
        startAt: timeRange.startAt,
        endAt: timeRange.endAt,
        totalPoints: 0,
      },
    });

    return Round.fromPersistence({
      id: round.id,
      startAt: round.startAt,
      endAt: round.endAt,
      totalPoints: round.totalPoints,
      participants: [],
    });
  }

  /**
   * Находит раунд по ID в базе данных
   */
  async findById(id: RoundId): Promise<Round | null> {
    const round = await this.prisma.round.findUnique({
      where: { id: id.value },
      include: { scores: { include: { user: true } } },
    });

    if (!round) return null;
    return this.mapToDomain(round);
  }

  /**
   * Получает список всех раундов из базы данных
   */
  async listRounds(): Promise<Round[]> {
    const rounds = await this.prisma.round.findMany({
      include: { scores: { include: { user: true } } },
      orderBy: { startAt: 'desc' },
    });

    return rounds.map((round) => this.mapToDomain(round));
  }

  /**
   * Находит активные или предстоящие раунды
   */
  async findActiveOrUpcomingRounds(): Promise<Round[]> {
    const now = new Date();
    const rounds = await this.prisma.round.findMany({
      where: {
        OR: [
          { startAt: { lte: now }, endAt: { gte: now } },
          { startAt: { gt: now } },
        ],
      },
      include: { scores: { include: { user: true } } },
      orderBy: { startAt: 'desc' },
    });

    return rounds.map((round) => this.mapToDomain(round));
  }

  /**
   * Обновляет очки раунда в базе данных
   */
  async updatePoints(id: RoundId, points: RoundPoints): Promise<void> {
    await this.prisma.round.update({
      where: { id: id.value },
      data: { totalPoints: points.total },
    });
  }

  /**
   * Удаляет раунд по ID
   */
  async deleteById(id: RoundId): Promise<void> {
    await this.prisma.round.delete({
      where: { id: id.value },
    });
  }

  /**
   * Обновляет статистику участника раунда
   */
  async updateParticipantStats(
    roundId: RoundId,
    userId: string,
    taps: number,
    points: number,
  ): Promise<void> {
    await this.prisma.roundScore.updateMany({
      where: {
        roundId: roundId.value,
        userId,
      },
      data: {
        taps,
        points,
      },
    });
  }

  /**
   * Находит раунд с участниками по ID
   */
  async findWithParticipants(id: RoundId): Promise<Round | null> {
    const round = await this.prisma.round.findUnique({
      where: { id: id.value },
      include: { scores: { include: { user: true } } },
    });

    if (!round) return null;
    return this.mapToDomain(round);
  }

  /**
   * Преобразует данные Prisma в доменную модель Round
   */
  private mapToDomain(prismaRound: {
    id: string;
    startAt: Date;
    endAt: Date;
    totalPoints: number;
    scores?: Array<{
      userId: string;
      taps: number;
      points: number;
      user: {
        username: string;
        role: string;
      };
    }>;
  }): Round {
    const participants = (prismaRound.scores || []).map((score) => ({
      userId: score.userId,
      username: score.user.username,
      taps: score.taps,
      points: score.user.role === 'nikita' ? 0 : score.points,
    }));

    return Round.fromPersistence({
      id: prismaRound.id,
      startAt: prismaRound.startAt,
      endAt: prismaRound.endAt,
      totalPoints: prismaRound.totalPoints,
      participants,
    });
  }
}
