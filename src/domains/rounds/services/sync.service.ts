import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RoundRecoveryService } from './round-recovery.service';
import { RoundStatusService } from './round-status.service';
import { RoundSyncService } from './round-sync.service';
import { RoundCleanupService } from './round-cleanup.service';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private syncInterval: NodeJS.Timeout | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isInitialized = false;

  constructor(
    private readonly recoveryService: RoundRecoveryService,
    private readonly statusService: RoundStatusService,
    private readonly syncService: RoundSyncService,
    private readonly cleanupService: RoundCleanupService,
  ) {}

  /**
   * Инициализация сервиса синхронизации
   */
  async onModuleInit() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    await this.recoveryService.recoverActiveRoundsFromDatabase();

    this.startSync();
    this.startStatusUpdates();
    this.startCleanup();
  }

  /**
   * Остановка всех интервалов при уничтожении модуля
   */
  onModuleDestroy() {
    this.stopSync();
    this.stopStatusUpdates();
    this.stopCleanup();
  }

  /**
   * Запускает синхронизацию Redis с базой данных
   */
  private startSync() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.syncInterval = setInterval(() => {
      void this.syncService.syncRedisToDatabase().catch(() => {});
    }, 10000);
  }

  /**
   * Останавливает синхронизацию
   */
  private stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Запускает обновление статусов раундов
   */
  private startStatusUpdates() {
    this.statusUpdateInterval = setInterval(() => {
      void this.statusService.updateRoundStatuses().catch(() => {});
    }, 2000);
  }

  /**
   * Останавливает обновление статусов
   */
  private stopStatusUpdates() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * Запускает очистку старых данных Redis
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      void this.cleanupService.cleanupOldRedisData().catch(() => {});
    }, 30000);
  }

  /**
   * Останавливает очистку данных
   */
  private stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
