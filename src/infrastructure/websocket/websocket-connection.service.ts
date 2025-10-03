import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { ExtendedSocket } from './types';

@Injectable()
export class WebSocketConnectionService {
  private server!: Server;
  private connectedClients = new Map<string, ExtendedSocket>();
  private isClosed = false;

  setServer(server: Server): void {
    this.server = server;
  }

  addClient(client: ExtendedSocket): void {
    if (this.isClosed) return;
    this.connectedClients.set(client.id, client);
  }

  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
  }

  getClient(clientId: string): ExtendedSocket | undefined {
    return this.connectedClients.get(clientId);
  }

  getAllClients(): ExtendedSocket[] {
    return Array.from(this.connectedClients.values());
  }

  getClientsByUser(userId: string): ExtendedSocket[] {
    return this.getAllClients().filter((client) => client.user?.id === userId);
  }

  getClientsByRole(role: string): ExtendedSocket[] {
    return this.getAllClients().filter((client) => client.user?.role === role);
  }

  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  setClosed(closed: boolean): void {
    this.isClosed = closed;
    if (closed) {
      this.closeAllConnections();
    }
  }

  private closeAllConnections(): void {
    this.connectedClients.forEach((socket) => {
      socket.disconnect();
    });
    this.connectedClients.clear();

    if (this.server) {
      void this.server.close();
    }
  }

  isServerAvailable(): boolean {
    return !this.isClosed && !!this.server;
  }
}
