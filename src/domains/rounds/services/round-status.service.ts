import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service';
import { GooseWebSocketGateway } from '../../../infrastructure/websocket/websocket.gateway';

interface RedisRoundState {
  id: string;
  startAt: string;
  endAt: string;
  totalPoints: number;
  status: string;
  participants: string[];
  lastUpdate: string;
}

@Injectable()
export class RoundStatusService {
  constructor(
    private readonly redisService: RedisConnectionService,
    private readonly websocketGateway: GooseWebSocketGateway,
  ) {}

  /**
   * Обновляет статусы активных раундов
   */
  async updateRoundStatuses() {
    const activeRoundIds = await this.redisService.smembers('active_rounds');

    for (const roundId of activeRoundIds) {
      await this.updateSingleRoundStatus(roundId);
    }
  }

  private async updateSingleRoundStatus(roundId: string) {
    const stateData = await this.redisService.get(`round:${roundId}:state`);
    if (!stateData) return;

    const redisState: RedisRoundState = JSON.parse(stateData);
    const now = new Date();
    const startAt = new Date(redisState.startAt);
    const endAt = new Date(redisState.endAt);

    const newStatus = this.determineRoundStatus(now, startAt, endAt);

    if (redisState.status !== newStatus) {
      await this.handleStatusChange(roundId, redisState, newStatus);
    }
  }

  private determineRoundStatus(
    now: Date,
    startAt: Date,
    endAt: Date,
  ): 'cooldown' | 'active' | 'finished' {
    if (now < startAt) return 'cooldown';
    if (now > endAt) return 'finished';
    return 'active';
  }

  private async handleStatusChange(
    roundId: string,
    redisState: RedisRoundState,
    newStatus: 'cooldown' | 'active' | 'finished',
  ) {
    this.broadcastRoundStatusChange(roundId, redisState, newStatus);

    redisState.status = newStatus;
    redisState.lastUpdate = new Date().toISOString();
    await this.redisService.set(
      `round:${roundId}:state`,
      JSON.stringify(redisState),
    );
  }

  private broadcastRoundStatusChange(
    roundId: string,
    redisState: RedisRoundState,
    newStatus: 'cooldown' | 'active' | 'finished',
  ) {
    this.websocketGateway.broadcastRoundUpdate(roundId, {
      id: roundId,
      startAt: redisState.startAt,
      endAt: redisState.endAt,
      totalPoints: redisState.totalPoints,
      status: newStatus,
    });
  }
}
