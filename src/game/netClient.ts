import type {
  BuggyConfig,
  PlayerControlInput,
  RaceEvent,
  RoomStateInfo,
  TrackDistanceKm,
  TrackId,
} from './types.ts';

export interface ServerBuggySnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  yaw: number;
  pitch: number;
  roll: number;
  steerAngle: number;
  wheelSpin: number;
  grounded: boolean;
  suspensionCompression: number;
  s: number;
  lateralOffset: number;
  boostMeter: number;
  isBoosting: boolean;
  heldPowerUp: 'nitro' | 'shockwave' | 'shield' | 'oil' | 'magnet' | null;
  nitroTimer: number;
  shieldTimer: number;
  spinOutTimer: number;
  hitFlashTimer: number;
  finished: boolean;
  finishTime: number | null;
  rank: number;
}

export interface ServerSimState {
  elapsedTime: number;
  countdownTimer: number;
  allFinished: boolean;
  hitstopTimer: number;
  cameraTrauma: number[];
  buggies: ServerBuggySnapshot[];
  pickupCooldowns: number[];
  hazards: { id: number; x: number; y: number; z: number; ownerId: string; ttl: number }[];
  shockwaves: { id: number; x: number; y: number; z: number; radius: number; maxRadius: number; alpha: number; colorHex: string }[];
  events: RaceEvent[];
}

export interface ServerSimConfig {
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  lengthMeters: number;
  buggies: {
    id: string;
    label: string;
    isHuman: boolean;
    humanIndex: number;
    config: BuggyConfig;
  }[];
}

export interface RoomClientListeners {
  onWelcome?: (clientId: string) => void;
  onRoomJoined?: (clientId: string, room: RoomStateInfo) => void;
  onRoomUpdate?: (room: RoomStateInfo) => void;
  onRoomError?: (message: string) => void;
  onRaceStart?: (room: RoomStateInfo, simConfig: ServerSimConfig, state: ServerSimState) => void;
  onRaceState?: (state: ServerSimState) => void;
  onReturnLobby?: (room: RoomStateInfo) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private listeners: RoomClientListeners = {};
  private connectPromise: Promise<void> | null = null;

  public setListeners(next: RoomClientListeners): void {
    this.listeners = next;
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;

      const timer = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          this.connectPromise = null;
          reject(new Error('WebSocket connection timed out'));
        }
      }, 6000);

      ws.onopen = () => {
        window.clearTimeout(timer);
        this.connectPromise = null;
        this.listeners.onConnectionChange?.(true);
        resolve();
      };

      ws.onerror = () => {
        window.clearTimeout(timer);
        this.connectPromise = null;
        this.listeners.onConnectionChange?.(false);
        reject(new Error('Failed to connect to multiplayer server'));
      };

      ws.onclose = () => {
        this.connectPromise = null;
        this.listeners.onConnectionChange?.(false);
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        switch (msg.type) {
          case 'welcome':
            this.clientId = String(msg.clientId);
            this.listeners.onWelcome?.(this.clientId);
            break;
          case 'room:joined':
            this.clientId = String(msg.clientId);
            this.listeners.onRoomJoined?.(this.clientId, msg.room as RoomStateInfo);
            break;
          case 'room:update':
            this.listeners.onRoomUpdate?.(msg.room as RoomStateInfo);
            break;
          case 'room:error':
            this.listeners.onRoomError?.(String(msg.message || 'Room error'));
            break;
          case 'race:start':
            this.listeners.onRaceStart?.(
              msg.room as RoomStateInfo,
              msg.simConfig as ServerSimConfig,
              msg.state as ServerSimState,
            );
            break;
          case 'race:state':
            this.listeners.onRaceState?.(msg.state as ServerSimState);
            break;
          case 'room:lobby':
            this.listeners.onReturnLobby?.(msg.room as RoomStateInfo);
            break;
        }
      };
    });

    return this.connectPromise;
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public async createRoom(params: {
    config: BuggyConfig;
    trackId: TrackId;
    distanceKm: TrackDistanceKm;
    maxOpponents: number;
    fillWithAi: boolean;
  }): Promise<void> {
    await this.ensureConnected();
    this.send({ type: 'create_room', ...params });
  }

  public async joinRoom(roomKey: string, config: BuggyConfig): Promise<void> {
    await this.ensureConnected();
    this.send({ type: 'join_room', roomKey: roomKey.trim().toUpperCase(), config });
  }

  public updateConfig(config: BuggyConfig): void {
    this.send({ type: 'update_config', config });
  }

  public updateSettings(params: {
    trackId: TrackId;
    distanceKm: TrackDistanceKm;
    maxOpponents: number;
    fillWithAi: boolean;
  }): void {
    this.send({ type: 'update_settings', ...params });
  }

  public startRace(): void {
    this.send({ type: 'start_race' });
  }

  public returnToLobby(): void {
    this.send({ type: 'return_lobby' });
  }

  public leaveRoom(): void {
    this.send({ type: 'leave_room' });
  }

  public sendInput(input: PlayerControlInput): void {
    this.send({ type: 'input', input });
  }

  public disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
