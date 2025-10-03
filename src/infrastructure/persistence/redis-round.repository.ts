import { Injectable, Inject } from '@nestjs/common';
import { RedisConnectionService } from '../redis/redis-connection.service';
import { RoundRepository } from '../../domains/rounds/repositories/round.repository';
import {
  Round,
  RoundId,
  RoundTimeRange,
  RoundPoints,
  RoundParticipant,
} from '../../domains/rounds/entities/round.entity';
import { USER_REPOSITORY } from '../../domains/domain.module';
import type { UserRepository } from '../../domains/users/repositories/user.repository';

interface RedisRoundState {
  id: string;
  startAt: string;
  endAt: string;
  totalPoints: number;
  status: string;
  participants: string[];
  lastUpdate: string;
}

interface RedisLeaderboardEntry {
  place: number;
  userId: string;
  username: string;
  taps: number;
  points: number;
}

export interface RedisLeaderboard {
  id: string;
  status: 'cooldown' | 'active' | 'finished';
  totalPoints: number;
  leaderboard: RedisLeaderboardEntry[];
}

@Injectable()
export class RedisRoundRepository implements RoundRepository {
  constructor(
    private readonly redis: RedisConnectionService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  /**
   * Находит раунд по ID в Redis
   */
  async findById(id: RoundId): Promise<Round | null> {
    const stateData = await this.redis.get(`round:${id.value}:state`);
    if (!stateData) {
      return null;
    }

    const state: RedisRoundState = JSON.parse(stateData);

    const round = await this.mapToDomain(state);
    return round;
  }

  /**
   * Находит раунд с участниками (только для активных раундов)
   */
  async findWithParticipants(id: RoundId): Promise<Round | null> {
    const isActive = await this.redis.sismember('active_rounds', id.value);
    if (isActive) {
      return this.findById(id);
    }

    return null;
  }

  /**
   * Получает список всех активных раундов
   */
  async listRounds(): Promise<Round[]> {
    const activeRoundIds = await this.redis.smembers('active_rounds');
    const rounds: Round[] = [];

    for (const roundId of activeRoundIds) {
      const round = await this.findById({ value: roundId });
      if (round) {
        rounds.push(round);
      }
    }

    return rounds;
  }

  /**
   * Создает новый раунд в Redis
   */
  async create(timeRange: RoundTimeRange, id?: string): Promise<Round> {
    const roundId = id || crypto.randomUUID();

    const round = Round.fromPersistence({
      id: roundId,
      startAt: timeRange.startAt,
      endAt: timeRange.endAt,
      totalPoints: 0,
      participants: [],
    });

    const state: RedisRoundState = {
      id: round.id.value,
      startAt: round.timeRange.startAt.toISOString(),
      endAt: round.timeRange.endAt.toISOString(),
      totalPoints: round.points.total,
      status: round.status.value,
      participants: [],
      lastUpdate: new Date().toISOString(),
    };

    await this.redis.set(
      `round:${round.id.value}:state`,
      JSON.stringify(state),
    );
    await this.redis.sadd('active_rounds', round.id.value);

    const leaderboard: RedisLeaderboard = {
      id: round.id.value,
      status: round.status.value,
      totalPoints: 0,
      leaderboard: [],
    };

    await this.redis.set(
      `round:${round.id.value}:leaderboard`,
      JSON.stringify(leaderboard),
      3600,
    );

    return round;
  }

  /**
   * Обновляет очки раунда
   */
  async updatePoints(id: RoundId, points: RoundPoints): Promise<void> {
    const stateData = await this.redis.get(`round:${id.value}:state`);
    if (!stateData) return;

    const state: RedisRoundState = JSON.parse(stateData);
    state.totalPoints = points.total;
    state.lastUpdate = new Date().toISOString();

    await this.redis.set(`round:${id.value}:state`, JSON.stringify(state));

    const leaderboardData = await this.redis.get(
      `round:${id.value}:leaderboard`,
    );
    if (leaderboardData) {
      const leaderboard: RedisLeaderboard = JSON.parse(leaderboardData);
      leaderboard.totalPoints = points.total;
      await this.redis.set(
        `round:${id.value}:leaderboard`,
        JSON.stringify(leaderboard),
        3600,
      );
    }
  }

  /**
   * Обновляет статистику участника раунда
   */
  async updateParticipantStats(
    id: RoundId,
    userId: string,
    taps: number,
    points: number,
  ): Promise<void> {
    const leaderboardData = await this.redis.get(
      `round:${id.value}:leaderboard`,
    );
    if (!leaderboardData) return;

    const leaderboard: RedisLeaderboard = JSON.parse(leaderboardData);

    let participant = leaderboard.leaderboard.find((p) => p.userId === userId);
    if (!participant) {
      const user = await this.userRepository.findById({ value: userId });
      const username = user ? user.username.value : `user_${userId}`;

      participant = {
        place: 0,
        userId,
        username,
        taps: 0,
        points: 0,
      };
      leaderboard.leaderboard.push(participant);
    }

    participant.taps = taps;
    participant.points = points;

    leaderboard.leaderboard.sort((a, b) => b.points - a.points);

    leaderboard.leaderboard.forEach((p, idx) => {
      p.place = idx + 1;
    });

    await this.redis.set(
      `round:${id.value}:leaderboard`,
      JSON.stringify(leaderboard),
      3600,
    );
  }

  async getLeaderboard(id: RoundId): Promise<RedisLeaderboard | null> {
    const leaderboardData = await this.redis.get(
      `round:${id.value}:leaderboard`,
    );
    if (!leaderboardData) return null;

    return JSON.parse(leaderboardData) as RedisLeaderboard;
  }

  async clearRoundData(id: RoundId): Promise<void> {
    await this.redis.srem('active_rounds', id.value);
    await this.redis.del(`round:${id.value}:state`);
    await this.redis.del(`round:${id.value}:leaderboard`);
  }

  private async getParticipantsFromRedis(
    roundId: string,
  ): Promise<RoundParticipant[]> {
    const participants: RoundParticipant[] = [];

    const userKeys = await this.redis.keys(`round:${roundId}:user:*:taps`);

    for (const key of userKeys) {
      const userId = key.match(/round:.*:user:(.*):taps/)?.[1];
      if (!userId) continue;

      const tapsStr = await this.redis.get(key);
      const taps = parseInt(tapsStr || '0', 10);

      const user = await this.userRepository.findById({ value: userId });
      if (!user) continue;

      const points = user.calculatePoints(taps);

      participants.push({
        userId,
        username: user.username.value,
        taps,
        points: user.isNikita() ? 0 : points,
      });
    }

    return participants;
  }

  private async mapToDomain(state: RedisRoundState): Promise<Round> {
    try {
      const participants = await this.getParticipantsFromRedis(state.id);

      return Round.fromPersistence({
        id: state.id,
        startAt: new Date(state.startAt),
        endAt: new Date(state.endAt),
        totalPoints: state.totalPoints,
        participants,
      });
    } catch {
      return Round.fromPersistence({
        id: state.id,
        startAt: new Date(state.startAt),
        endAt: new Date(state.endAt),
        totalPoints: state.totalPoints,
        participants: [],
      });
    }
  }

  async deleteById(id: RoundId): Promise<void> {
    await this.redis.del(`round:${id.value}:state`);
    await this.redis.srem('active_rounds', id.value);
    await this.redis.del(`round:${id.value}:leaderboard`);

    const roundKeys = await this.redis.keys(`round:${id.value}:*`);
    if (roundKeys.length > 0) {
      for (const key of roundKeys) {
        await this.redis.del(key);
      }
    }
  }
}
