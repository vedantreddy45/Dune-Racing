import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createRaceSimulation, stepRaceSimulation } from './src/game/physics.ts';
import type {
  BuggyConfig,
  PlayMode,
  PlayerControlInput,
  RaceSimulation,
  RoomMemberInfo,
  RoomStateInfo,
  TrackDistanceKm,
  TrackId,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  clientId: string;
  ws: WebSocket;
  roomKey: string | null;
}

interface RoomInternal {
  roomKey: string;
  hostId: string;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  maxOpponents: number; // 2..5
  fillWithAi: boolean;
  status: 'lobby' | 'racing' | 'finished';
  members: Map<string, RoomMemberInfo>;
  inputs: Map<string, PlayerControlInput>;
  pendingItemPress: Map<string, boolean>;
  sim: RaceSimulation | null;
  tickTimer: NodeJS.Timeout | null;
  lastTickMs: number;
}

const rooms = new Map<string, RoomInternal>();
const clients = new Map<string, ConnectedClient>();

const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomKey(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let key = '';
    for (let i = 0; i < 6; i++) {
      key += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
    }
    if (!rooms.has(key)) return key;
  }
  return `DR${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function generateClientId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function serializeRoom(room: RoomInternal): RoomStateInfo {
  const members = Array.from(room.members.values()).sort((a, b) => a.slotIndex - b.slotIndex);
  return {
    roomKey: room.roomKey,
    hostId: room.hostId,
    trackId: room.trackId,
    distanceKm: room.distanceKm,
    maxOpponents: room.maxOpponents,
    fillWithAi: room.fillWithAi,
    status: room.status,
    members,
  };
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(room: RoomInternal, payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const memberId of room.members.keys()) {
    const client = clients.get(memberId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function reassignSlots(room: RoomInternal): void {
  const list = Array.from(room.members.values()).sort((a, b) => a.slotIndex - b.slotIndex);
  list.forEach((m, idx) => {
    m.slotIndex = idx;
    m.isHost = m.clientId === room.hostId;
  });
}

function stopRoomLoop(room: RoomInternal): void {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
}

function removeClientFromRoom(client: ConnectedClient): void {
  if (!client.roomKey) return;
  const room = rooms.get(client.roomKey);
  client.roomKey = null;
  if (!room) return;

  room.members.delete(client.clientId);
  room.inputs.delete(client.clientId);
  room.pendingItemPress.delete(client.clientId);

  if (room.members.size === 0) {
    stopRoomLoop(room);
    rooms.delete(room.roomKey);
    return;
  }

  if (room.hostId === client.clientId) {
    const nextHost = room.members.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.clientId;
    }
  }
  reassignSlots(room);
  broadcastToRoom(room, { type: 'room:update', room: serializeRoom(room) });
}

function serializeSimState(sim: RaceSimulation) {
  return {
    elapsedTime: sim.elapsedTime,
    countdownTimer: sim.countdownTimer,
    allFinished: sim.allFinished,
    hitstopTimer: sim.hitstopTimer,
    cameraTrauma: sim.cameraTrauma,
    buggies: sim.buggies.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      vx: b.vx,
      vy: b.vy,
      vz: b.vz,
      speed: b.speed,
      yaw: b.yaw,
      pitch: b.pitch,
      roll: b.roll,
      steerAngle: b.steerAngle,
      wheelSpin: b.wheelSpin,
      grounded: b.grounded,
      suspensionCompression: b.suspensionCompression,
      s: b.s,
      lateralOffset: b.lateralOffset,
      boostMeter: b.boostMeter,
      isBoosting: b.isBoosting,
      heldPowerUp: b.heldPowerUp,
      nitroTimer: b.nitroTimer,
      shieldTimer: b.shieldTimer,
      spinOutTimer: b.spinOutTimer,
      hitFlashTimer: b.hitFlashTimer,
      finished: b.finished,
      finishTime: b.finishTime,
      rank: b.rank,
    })),
    pickupCooldowns: sim.pickups.map((p) => p.cooldown),
    hazards: sim.hazards,
    shockwaves: sim.shockwaves,
    events: sim.events,
  };
}

function startRoomRace(room: RoomInternal): void {
  stopRoomLoop(room);
  reassignSlots(room);

  const humanSlots = Array.from(room.members.values())
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((m, idx) => ({
      id: m.clientId,
      label: m.config.name || `PLAYER ${idx + 1}`,
      humanIndex: idx,
      config: m.config,
    }));

  const mode: PlayMode = 'online';
  const sim = createRaceSimulation({
    trackId: room.trackId,
    distanceKm: room.distanceKm,
    mode,
    p1Config: humanSlots[0].config,
    humanSlots,
    maxOpponents: room.maxOpponents,
    fillWithAi: room.fillWithAi,
    skipCountdown: false,
  });

  room.sim = sim;
  room.status = 'racing';
  room.lastTickMs = Date.now();
  room.inputs.clear();
  room.pendingItemPress.clear();

  broadcastToRoom(room, {
    type: 'room:update',
    room: serializeRoom(room),
  });

  broadcastToRoom(room, {
    type: 'race:start',
    room: serializeRoom(room),
    simConfig: {
      trackId: sim.trackId,
      distanceKm: sim.distanceKm,
      lengthMeters: sim.lengthMeters,
      buggies: sim.buggies.map((b) => ({
        id: b.id,
        label: b.label,
        isHuman: b.isHuman,
        humanIndex: b.humanIndex,
        config: b.config,
      })),
    },
    state: serializeSimState(sim),
  });

  room.tickTimer = setInterval(() => {
    if (!room.sim || room.status !== 'racing') return;
    const now = Date.now();
    const dt = Math.min(0.05, Math.max(0.01, (now - room.lastTickMs) / 1000));
    room.lastTickMs = now;

    const orderedMembers = Array.from(room.members.values()).sort(
      (a, b) => a.slotIndex - b.slotIndex,
    );
    const inputs: PlayerControlInput[] = orderedMembers.map((m) => {
      const base = room.inputs.get(m.clientId) ?? {
        throttle: 0,
        steer: 0,
        boost: false,
        useItemJustPressed: false,
      };
      const itemPressed = room.pendingItemPress.get(m.clientId) === true;
      room.pendingItemPress.set(m.clientId, false);
      return {
        throttle: Math.max(-1, Math.min(1, base.throttle)),
        steer: Math.max(-1, Math.min(1, base.steer)),
        boost: Boolean(base.boost),
        useItemJustPressed: itemPressed,
      };
    });

    stepRaceSimulation(room.sim, dt, inputs);
    broadcastToRoom(room, {
      type: 'race:state',
      state: serializeSimState(room.sim),
    });

    if (room.sim.allFinished) {
      room.status = 'finished';
      stopRoomLoop(room);
      broadcastToRoom(room, {
        type: 'room:update',
        room: serializeRoom(room),
      });
    }
  }, 50);
}

async function bootstrap() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/rooms/:key', (req, res) => {
    const key = String(req.params.key || '').trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({ room: serializeRoom(room) });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = generateClientId();
    const client: ConnectedClient = { clientId, ws, roomKey: null };
    clients.set(clientId, client);

    sendJson(ws, { type: 'welcome', clientId });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;
      if (type === 'create_room') {
        removeClientFromRoom(client);
        const roomKey = generateRoomKey();
        const maxOpp = Math.max(2, Math.min(5, Number(msg.maxOpponents) || 3));
        const dist = ([2, 3, 5].includes(Number(msg.distanceKm)) ? Number(msg.distanceKm) : 3) as TrackDistanceKm;
        const trackId = (['redrock', 'pinecrest', 'saltflats'].includes(String(msg.trackId))
          ? String(msg.trackId)
          : 'redrock') as TrackId;
        const config = msg.config as BuggyConfig;

        const room: RoomInternal = {
          roomKey,
          hostId: clientId,
          trackId,
          distanceKm: dist,
          maxOpponents: maxOpp,
          fillWithAi: msg.fillWithAi !== false,
          status: 'lobby',
          members: new Map(),
          inputs: new Map(),
          pendingItemPress: new Map(),
          sim: null,
          tickTimer: null,
          lastTickMs: Date.now(),
        };

        room.members.set(clientId, {
          clientId,
          slotIndex: 0,
          config,
          isHost: true,
          ready: true,
        });
        rooms.set(roomKey, room);
        client.roomKey = roomKey;

        sendJson(ws, {
          type: 'room:joined',
          clientId,
          room: serializeRoom(room),
        });
      } else if (type === 'join_room') {
        const key = String(msg.roomKey || '').trim().toUpperCase();
        const room = rooms.get(key);
        if (!room) {
          sendJson(ws, { type: 'room:error', message: `No room found for key "${key}".` });
          return;
        }
        if (room.status === 'racing') {
          sendJson(ws, { type: 'room:error', message: 'Race already in progress in this room.' });
          return;
        }
        const maxHumanSlots = 1 + room.maxOpponents; // up to 6 total racers
        if (!room.members.has(clientId) && room.members.size >= maxHumanSlots) {
          sendJson(ws, {
            type: 'room:error',
            message: `Room ${key} is full (${maxHumanSlots} players max).`,
          });
          return;
        }

        if (client.roomKey && client.roomKey !== key) {
          removeClientFromRoom(client);
        }

        const config = msg.config as BuggyConfig;
        if (!room.members.has(clientId)) {
          room.members.set(clientId, {
            clientId,
            slotIndex: room.members.size,
            config,
            isHost: room.hostId === clientId,
            ready: true,
          });
        }
        reassignSlots(room);
        client.roomKey = key;

        const serialized = serializeRoom(room);
        sendJson(ws, { type: 'room:joined', clientId, room: serialized });
        broadcastToRoom(room, { type: 'room:update', room: serialized });
      } else if (type === 'leave_room') {
        removeClientFromRoom(client);
      } else if (type === 'update_config') {
        if (!client.roomKey) return;
        const room = rooms.get(client.roomKey);
        if (!room) return;
        const member = room.members.get(clientId);
        if (!member) return;
        member.config = msg.config as BuggyConfig;
        broadcastToRoom(room, { type: 'room:update', room: serializeRoom(room) });
      } else if (type === 'update_settings') {
        if (!client.roomKey) return;
        const room = rooms.get(client.roomKey);
        if (!room || room.hostId !== clientId || room.status === 'racing') return;
        if (['redrock', 'pinecrest', 'saltflats'].includes(String(msg.trackId))) {
          room.trackId = msg.trackId as TrackId;
        }
        if ([2, 3, 5].includes(Number(msg.distanceKm))) {
          room.distanceKm = Number(msg.distanceKm) as TrackDistanceKm;
        }
        if (msg.maxOpponents !== undefined) {
          room.maxOpponents = Math.max(2, Math.min(5, Number(msg.maxOpponents)));
        }
        if (msg.fillWithAi !== undefined) {
          room.fillWithAi = Boolean(msg.fillWithAi);
        }
        broadcastToRoom(room, { type: 'room:update', room: serializeRoom(room) });
      } else if (type === 'start_race') {
        if (!client.roomKey) return;
        const room = rooms.get(client.roomKey);
        if (!room || room.hostId !== clientId) return;
        startRoomRace(room);
      } else if (type === 'return_lobby') {
        if (!client.roomKey) return;
        const room = rooms.get(client.roomKey);
        if (!room || room.hostId !== clientId) return;
        stopRoomLoop(room);
        room.status = 'lobby';
        room.sim = null;
        broadcastToRoom(room, { type: 'room:lobby', room: serializeRoom(room) });
      } else if (type === 'input') {
        if (!client.roomKey) return;
        const room = rooms.get(client.roomKey);
        if (!room || room.status !== 'racing') return;
        const inp = msg.input as PlayerControlInput;
        room.inputs.set(clientId, inp);
        if (inp.useItemJustPressed) {
          room.pendingItemPress.set(clientId, true);
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(client);
      clients.delete(clientId);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Dune Runners server listening on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
