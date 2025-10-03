import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export type ActiveRoundSummary = {
  id: string;
  startAt: Date;
  endAt: Date;
  totalPoints: number;
  scores: { userId: string; user: { username: string } }[];
};

export type RoundWithScores = {
  id: string;
  totalPoints: number;
  scores: { userId: string }[];
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const dbConfig = configService.get('app.database');
    const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`;

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }
  /**
   * Подключение к базе данных при инициализации модуля
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Отключение от базы данных при уничтожении модуля
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Находит активный раунд на указанную дату
   */
  async findActiveRound(now: Date): Promise<ActiveRoundSummary | null> {
    const round = await this.round.findFirst({
      where: { startAt: { lte: now }, endAt: { gte: now } },
      include: { scores: { include: { user: true } } },
    });
    if (!round) return null;
    return {
      id: round.id,
      startAt: round.startAt,
      endAt: round.endAt,
      totalPoints: round.totalPoints,
      scores: round.scores.map((s) => ({
        userId: s.userId,
        user: { username: s.user.username },
      })),
    };
  }

  /**
   * Получает раунд с результатами пользователей
   */
  async getRoundWithScores(roundId: string): Promise<RoundWithScores | null> {
    const round = await this.round.findUnique({
      where: { id: roundId },
      include: { scores: true },
    });
    if (!round) return null;
    return {
      id: round.id,
      totalPoints: round.totalPoints,
      scores: round.scores.map((s) => ({ userId: s.userId })),
    };
  }

  /**
   * Обновляет общее количество очков в раунде
   */
  async updateRoundTotalPoints(
    roundId: string,
    totalPoints: number,
  ): Promise<void> {
    await this.round.update({ where: { id: roundId }, data: { totalPoints } });
  }

  /**
   * Создает запись результата пользователя в раунде
   */
  async createRoundScore(roundId: string, userId: string): Promise<void> {
    await this.roundScore.create({
      data: { roundId, userId, taps: 0, points: 0 },
    });
  }

  /**
   * Получает детальную информацию о раунде для отображения
   */
  async getRoundDetailsForInfo(id: string): Promise<{
    id: string;
    startAt: Date;
    endAt: Date;
    totalPoints: number;
    scores: { userId: string; points: number; user: { username: string } }[];
  } | null> {
    const round = await this.round.findUnique({
      where: { id },
      include: { scores: { include: { user: true } } },
    });
    if (!round) return null;
    return {
      id: round.id,
      startAt: round.startAt,
      endAt: round.endAt,
      totalPoints: round.totalPoints,
      scores: round.scores.map((s) => ({
        userId: s.userId,
        points: s.points,
        user: { username: s.user.username },
      })),
    };
  }

  /**
   * Получает список всех раундов, отсортированных по дате начала
   */
  async listRounds(): Promise<
    Array<{ id: string; startAt: Date; endAt: Date; totalPoints: number }>
  > {
    const rounds = await this.round.findMany({
      orderBy: { startAt: 'desc' },
    });
    return rounds.map((r) => ({
      id: r.id,
      startAt: r.startAt,
      endAt: r.endAt,
      totalPoints: r.totalPoints,
    }));
  }

  /**
   * Получает общее количество очков раунда
   */
  async getRoundTotalPoints(
    id: string,
  ): Promise<{ id: string; totalPoints: number } | null> {
    const round = await this.round.findUnique({
      where: { id },
      select: { id: true, totalPoints: true },
    });
    return round ?? null;
  }

  /**
   * Создает новый раунд
   */
  async createRound(
    startAt: Date,
    endAt: Date,
  ): Promise<{ id: string; startAt: Date; endAt: Date; totalPoints: number }> {
    const created = await this.round.create({
      data: { startAt, endAt },
      select: { id: true, startAt: true, endAt: true, totalPoints: true },
    });
    return created;
  }

  /**
   * Создает или обновляет запись результата раунда в транзакции
   */
  async upsertRoundScoreTx(
    tx: Prisma.TransactionClient,
    roundId: string,
    userId: string,
  ): Promise<{ id: string; taps: number; points: number }> {
    const rs = await tx.roundScore.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId, taps: 0, points: 0 },
      update: {},
      select: { id: true, taps: true, points: true },
    });
    return rs;
  }

  /**
   * Обновляет результат раунда в транзакции
   */
  async updateRoundScoreTx(
    tx: Prisma.TransactionClient,
    roundScoreId: string,
    tapInc: number,
    pointInc: number,
  ): Promise<{ points: number; taps: number }> {
    const updated = await tx.roundScore.update({
      where: { id: roundScoreId },
      data: {
        taps: { increment: tapInc },
        points: { increment: pointInc },
      },
      select: { points: true, taps: true },
    });
    return updated;
  }

  async incrementRoundTotalPointsTx(
    tx: Prisma.TransactionClient,
    roundId: string,
    pointInc: number,
  ): Promise<void> {
    await tx.round.update({
      where: { id: roundId },
      data: { totalPoints: { increment: pointInc } },
    });
  }

  async updateRoundScoreTaps(
    roundId: string,
    userId: string,
    taps: number,
  ): Promise<void> {
    await this.roundScore.update({
      where: { roundId_userId: { roundId, userId } },
      data: { taps },
    });
  }
}
