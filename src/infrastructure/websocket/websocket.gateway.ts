import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import {
  Injectable,
  OnModuleDestroy,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GooseRoundsService } from '../../domains/rounds/rounds.service';
import { GooseAuthService, JwtPayload } from '../../domains/users/auth.service';
import { WebSocketConnectionService } from '../../infrastructure/websocket/websocket-connection.service';
import { WebSocketBroadcastService } from '../../infrastructure/websocket/websocket-broadcast.service';
import { RedisPubSubService } from '../../infrastructure/redis/redis-pubsub.service';
import type { ExtendedSocket } from '../../infrastructure/websocket/types';
import type { AuthenticatedUser } from '../../types/user.types';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GooseWebSocketGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy,
    OnApplicationShutdown
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roundsService: GooseRoundsService,
    private readonly connectionService: WebSocketConnectionService,
    private readonly broadcastService: WebSocketBroadcastService,
    private readonly pubSubService: RedisPubSubService,
    private readonly jwtService: JwtService,
    private readonly authService: GooseAuthService,
  ) {}

  /**
   * Инициализация WebSocket сервера
   */
  afterInit(server: Server) {
    this.server = server;
    this.connectionService.setServer(server);

    this.pubSubService.on('inter-instance-message', (message) => {
      this.broadcastService.handleInterInstanceMessage(message);
    });
  }

  /**
   * Обработка подключения клиента с авторизацией через cookie
   */
  handleConnection(client: ExtendedSocket) {
    const clientId = client.id;
    if (!clientId) return;

    try {
      const token = this.extractTokenFromCookie(client);
      if (token) {
        this.authenticateClient(client, token);
      } else {
        client.disconnect();
      }
    } catch {
      client.disconnect();
    }
  }

  /**
   * Извлекает токен из cookie заголовка
   */
  private extractTokenFromCookie(client: ExtendedSocket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie ?? '';
    return cookieHeader
      .split(';')
      .map((c) => c.trim())
      .map((c) => c.split('='))
      .find(([k]) => k === 'token')?.[1];
  }

  /**
   * Аутентифицирует клиента по JWT токену
   */
  private authenticateClient(client: ExtendedSocket, token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      this.authService
        .validateUser(payload)
        .then((user: AuthenticatedUser) => {
          client.user = user;
          this.connectionService.addClient(client);
        })
        .catch(() => {
          client.disconnect();
        });
    } catch {
      client.disconnect();
    }
  }

  /**
   * Обработка отключения клиента
   */
  handleDisconnect(client: ExtendedSocket) {
    this.connectionService.removeClient(client.id);
  }

  /**
   * Закрытие соединений при уничтожении модуля
   */
  onModuleDestroy() {
    this.connectionService.setClosed(true);
  }

  /**
   * Закрытие соединений при остановке приложения
   */
  onApplicationShutdown() {
    this.connectionService.setClosed(true);
  }

  /**
   * Обработка ping запроса
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: ExtendedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { room: string },
  ) {
    await client.join(data.room);
    client.emit('joined_room', { room: data.room, success: true });
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { room: string },
  ) {
    await client.leave(data.room);
    client.emit('left_room', { room: data.room, success: true });
  }

  /**
   * Присоединение клиента к комнате раунда
   */
  @SubscribeMessage('join_round')
  async handleJoinRound(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { roundId: string },
  ) {
    if (!client.id) return;

    void client.join(data.roundId);
    client.emit('joined_round', { roundId: data.roundId, success: true });

    const leaderboard = await this.roundsService.getLeaderboard(data.roundId);
    client.emit('leaderboard', leaderboard);
  }

  /**
   * Покидание клиентом комнаты раунда
   */
  @SubscribeMessage('leave_round')
  handleLeaveRound(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { roundId: string },
  ) {
    if (!client.id) return;

    void client.leave(data.roundId);
    client.emit('left_round', { roundId: data.roundId, success: true });
  }

  /**
   * Отправляет успешный результат тапа
   */
  private sendTapSuccess(
    client: ExtendedSocket,
    points: number,
    timestamp: string,
  ) {
    client.emit('tap_result', {
      success: true,
      myPoints: points,
      timestamp,
    });
  }

  /**
   * Отправляет неуспешный результат тапа
   */
  private sendTapFailure(
    client: ExtendedSocket,
    timestamp: string,
    error: string,
  ) {
    client.emit('tap_result', {
      success: false,
      myPoints: 0,
      timestamp,
      error,
    });
  }

  /**
   * Отправляет обновленный leaderboard всем пользователям в раунде
   */
  private async broadcastUpdatedLeaderboard(roundId: string) {
    const leaderboard = await this.roundsService.getLeaderboard(roundId);
    this.broadcastLeaderboard(roundId, leaderboard);
  }

  /**
   * Получение leaderboard раунда
   */
  @SubscribeMessage('get_leaderboard')
  async handleGetLeaderboard(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { roundId: string },
  ) {
    if (!client.id) return;

    const leaderboard = await this.roundsService.getLeaderboard(data.roundId);
    client.emit('leaderboard', leaderboard);
  }

  @SubscribeMessage('tap')
  async handleTap(
    @ConnectedSocket() client: ExtendedSocket,
    @MessageBody() data: { roundId: string },
  ) {
    const timestamp = new Date().toISOString();

    if (!client.user) {
      client.emit('tap_result', {
        success: false,
        myPoints: 0,
        timestamp,
        error: 'unauthorized',
      });
      return;
    }

    try {
      const result = await this.roundsService.tap(data.roundId, client.user);
      client.emit('tap_result', {
        success: true,
        myPoints: result.points,
        timestamp,
      });
      await this.broadcastUpdatedLeaderboard(data.roundId);
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'tap failed';
      client.emit('tap_result', {
        success: false,
        myPoints: 0,
        timestamp,
        error: message,
      });
    }
  }

  broadcastUserTap(
    roundId: string,
    userId: string,
    data: { myPoints: number; timestamp: string },
  ) {
    this.broadcastService.broadcastUserTap(roundId, userId, data);
  }

  broadcastRoundUpdate(
    roundId: string,
    data: {
      id: string;
      startAt: string;
      endAt: string;
      totalPoints: number;
      status: 'cooldown' | 'active' | 'finished';
    },
  ) {
    this.broadcastService.broadcastRoundUpdate(roundId, data);
  }

  broadcastRoundFinished(
    roundId: string,
    data: {
      id: string;
      totalPoints: number;
      winner: {
        username: string;
        points: number;
      } | null;
    },
  ) {
    this.broadcastService.broadcastRoundFinished(roundId, data);
  }

  broadcastLeaderboard(
    roundId: string,
    leaderboard: {
      id: string;
      status: 'cooldown' | 'active' | 'finished';
      totalPoints: number;
      leaderboard: Array<{
        place: number;
        userId: string;
        username: string;
        taps: number;
        points: number;
      }>;
    },
  ) {
    this.server.to(roundId).emit('leaderboard', leaderboard);
  }
}
