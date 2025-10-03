export type UserRole = 'admin' | 'survivor' | 'nikita';

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export type PublicUser = {
  id: string;
  username: string;
  role: UserRole;
};
