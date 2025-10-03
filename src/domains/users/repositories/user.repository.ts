import { User, UserId } from '../entities/user.entity';

export interface UserRepository {
  /**
   * Получение пользователя по ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Получение пользователя по имени
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Создание нового пользователя
   */
  create(
    username: string,
    role: 'admin' | 'survivor' | 'nikita',
    password: string,
  ): Promise<User>;

  /**
   * Обновление пользователя
   */
  update(user: User): Promise<void>;

  /**
   * Получение всех пользователей
   */
  findAll(): Promise<User[]>;

  /**
   * Проверка существования пользователя
   */
  exists(id: UserId): Promise<boolean>;
}
