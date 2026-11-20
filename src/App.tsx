import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineActions, GameCanvas } from './components/GameCanvas';
import { GaragePanel } from './components/GaragePanel';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobbyPanel } from './components/OnlineLobbyPanel';
import { RaceHud } from './components/RaceHud';
import { TitleOverlay } from './components/TitleOverlay';
import {
  addLeaderboardRecord,
  formatVehicleSpec,
  loadLeaderboard,
  resetLeaderboard,
  saveLeaderboard,
} from './game/leaderboard';
import { MultiplayerClient } from './game/netClient';
import {
  BuggyConfig,
  CHASSIS_OPTIONS,
  GamePhase,
  HudSnapshot,
  LeaderboardEntry,
  MainMode,
  MultiplayerKind,
  PlayMode,
  PlayerControlInput,
  RoomStateInfo,
  TIRE_OPTIONS,
  TrackDistanceKm,
  TrackId,
} from './game/types';

const DEFAULT_P1: BuggyConfig = {
  name: 'PLAYER 1',
  colorHex: '#f97316',
  accentHex: '#fde047',
  chassis: 'striker',
  tires: 'knobby',
  rig: 'lightbar',
};

const DEFAULT_P2: BuggyConfig = {
  name: 'PLAYER 2',
  colorHex: '#0ea5e9',
  accentHex: '#e0f2fe',
  chassis: 'dart',
  tires: 'paddle',
  rig: 'wing',
};

function readInitialUrlParams(): {
  mainMode: MainMode;
  multiplayerKind: MultiplayerKind;
  distanceKm: TrackDistanceKm;
  roomKey: string;
} {
  if (typeof window === 'undefined') {
    return { mainMode: 'multiplayer', multiplayerKind: 'online', distanceKm: 3, roomKey: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';
  const modeParam = params.get('mode');
  const distParam = Number(params.get('distance'));
  const roomParam = (params.get('room') || '').trim().toUpperCase();

  const distanceKm: TrackDistanceKm =
    distParam === 2 || distParam === 3 || distParam === 5 ? distParam : 3;

  if (roomParam) {
    return { mainMode: 'multiplayer', multiplayerKind: 'online', distanceKm, roomKey: roomParam };
  }
  if (modeParam === 'solo') {
    return { mainMode: 'solo', multiplayerKind: 'online', distanceKm, roomKey: '' };
  }
  if (modeParam === 'splitscreen' || autostart) {
    return { mainMode: 'multiplayer', multiplayerKind: 'splitscreen', distanceKm, roomKey: '' };
  }
  return { mainMode: 'multiplayer', multiplayerKind: 'online', distanceKm, roomKey: '' };
}

export default function App() {
  const initialParams = useRef(readInitialUrlParams());

  const [phase, setPhase] = useState<GamePhase>('title');
  const [mainMode, setMainMode] = useState<MainMode>(initialParams.current.mainMode);
  const [multiplayerKind, setMultiplayerKind] = useState<MultiplayerKind>(
    initialParams.current.multiplayerKind,
  );
  const [trackId, setTrackId] = useState<TrackId>('redrock');
  const [distanceKm, setDistanceKm] = useState<TrackDistanceKm>(initialParams.current.distanceKm);
  const [maxOpponents, setMaxOpponents] = useState<number>(3);
  const [p1Config, setP1Config] = useState<BuggyConfig>(DEFAULT_P1);
  const [p2Config, setP2Config] = useState<BuggyConfig>(DEFAULT_P2);
  const [garageOpen, setGarageOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [savedRank, setSavedRank] = useState<number | null>(null);
  const [showPostRaceModal, setShowPostRaceModal] = useState(false);

  // Online multiplayer room state
  const [joinKeyInput, setJoinKeyInput] = useState(initialParams.current.roomKey);
  const [onlineRoom, setOnlineRoom] = useState<RoomStateInfo | null>(null);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [connectingRoom, setConnectingRoom] = useState(false);

  const actionsRef = useRef<EngineActions | null>(null);
  const recordedRunRef = useRef(false);
  const netClientRef = useRef<MultiplayerClient | null>(null);
  if (!netClientRef.current) {
    netClientRef.current = new MultiplayerClient();
  }

  const effectiveMode: PlayMode =
    mainMode === 'solo'
      ? 'solo'
      : multiplayerKind === 'splitscreen'
        ? 'splitscreen'
        : 'online';

  // Wire WebSocket listeners
  useEffect(() => {
    const client = netClientRef.current!;
    client.setListeners({
      onWelcome: (cid) => {
        setMyClientId(cid);
      },
      onRoomJoined: (cid, room) => {
        setMyClientId(cid);
        setOnlineRoom(room);
        setTrackId(room.trackId);
        setDistanceKm(room.distanceKm);
        setMaxOpponents(room.maxOpponents);
        setRoomError(null);
        setConnectingRoom(false);
      },
      onRoomUpdate: (room) => {
        setOnlineRoom(room);
        setTrackId(room.trackId);
        setDistanceKm(room.distanceKm);
        setMaxOpponents(room.maxOpponents);
        setRoomError(null);
      },
      onRoomError: (msg) => {
        setRoomError(msg);
        setConnectingRoom(false);
      },
      onRaceStart: (room, simConfig, state) => {
        setOnlineRoom(room);
        setRoomError(null);
        recordedRunRef.current = false;
        setSavedRank(null);
        setGarageOpen(false);
        setLeaderboardOpen(false);
        const cid = client.getClientId();
        const mine = simConfig.buggies.find((b) => b.id === cid);
        actionsRef.current?.startOnlineRace(simConfig, state, mine ? mine.humanIndex : 0);
      },
      onRaceState: (state) => {
        actionsRef.current?.pushOnlineState(state);
      },
      onReturnLobby: (room) => {
        setOnlineRoom(room);
        actionsRef.current?.returnToTitle();
      },
    });

    // Auto-join if ?room=KEY was provided in invite link
    if (initialParams.current.roomKey) {
      setConnectingRoom(true);
      client
        .joinRoom(initialParams.current.roomKey, DEFAULT_P1)
        .catch((err) => {
          setConnectingRoom(false);
          setRoomError(err instanceof Error ? err.message : 'Unable to join room');
        });
    }

    return () => {
      client.disconnect();
    };
  }, []);

  const handleMainModeChange = useCallback((next: MainMode) => {
    setMainMode(next);
    setRoomError(null);
    if (next === 'multiplayer') {
      setMaxOpponents((prev) => Math.max(2, Math.min(5, prev)));
    }
  }, []);

  const handlePhaseChange = useCallback((next: GamePhase) => {
    setPhase(next);
    if (next === 'playing') {
      setGarageOpen(false);
      setLeaderboardOpen(false);
      setShowPostRaceModal(false);
    }
    if (next === 'title') {
      recordedRunRef.current = false;
      setSavedRank(null);
      setShowPostRaceModal(false);
    }
    if (next === 'gameover') {
      setShowPostRaceModal(false);
    }
  }, []);

  // Show Leaderboard automatically 2 seconds after the race stops at the finish line
  useEffect(() => {
    if (phase !== 'gameover') return;
    const timer = window.setTimeout(() => {
      setShowPostRaceModal(true);
      setLeaderboardOpen(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Automatically save finished human time(s) to leaderboard once on gameover
  useEffect(() => {
    if (phase !== 'gameover' || !hud || recordedRunRef.current) return;
    const finishedHumans = hud.standings.filter((s) => s.isHuman && s.finishTime !== null);
    if (finishedHumans.length === 0) return;
    recordedRunRef.current = true;

    let currentEntries = leaderboard;
    let bestRank: number | null = null;

    for (const h of finishedHumans) {
      if (h.finishTime === null) continue;
      const chassisName = CHASSIS_OPTIONS.find((c) => c.id === h.chassis)?.name ?? 'Buggy';
      const tireName = TIRE_OPTIONS.find((t) => t.id === h.tires)?.name ?? 'Tires';
      const res = addLeaderboardRecord(currentEntries, {
        trackId: hud.trackId,
        distanceKm: hud.distanceKm,
        driverName: h.label,
        vehicleLabel: formatVehicleSpec(chassisName, tireName),
        colorHex: h.colorHex,
        mode: hud.mode,
        timeSeconds: h.finishTime,
      });
      currentEntries = res.entries;
      if (bestRank === null || res.rank < bestRank) {
        bestRank = res.rank;
      }
    }

    setLeaderboard(currentEntries);
    saveLeaderboard(currentEntries);
    setSavedRank(bestRank);
  }, [phase, hud, leaderboard]);

  const handleStartLocalRace = useCallback(() => {
    recordedRunRef.current = false;
    setSavedRank(null);
    setGarageOpen(false);
    setLeaderboardOpen(false);
    actionsRef.current?.startRace();
  }, []);

  const handleRestartRace = useCallback(() => {
    recordedRunRef.current = false;
    setSavedRank(null);
    actionsRef.current?.restartRace();
  }, []);

  const handleCreateOnlineRoom = useCallback(async () => {
    setRoomError(null);
    setConnectingRoom(true);
    try {
      await netClientRef.current!.createRoom({
        config: p1Config,
        trackId,
        distanceKm,
        maxOpponents: Math.max(2, Math.min(5, maxOpponents)),
        fillWithAi: true,
      });
    } catch (err) {
      setConnectingRoom(false);
      setRoomError(err instanceof Error ? err.message : 'Unable to create room');
    }
  }, [p1Config, trackId, distanceKm, maxOpponents]);

  const handleJoinOnlineRoom = useCallback(
    async (key: string) => {
      const cleaned = key.trim().toUpperCase();
      if (!cleaned) return;
      setRoomError(null);
      setConnectingRoom(true);
      try {
        await netClientRef.current!.joinRoom(cleaned, p1Config);
      } catch (err) {
        setConnectingRoom(false);
        setRoomError(err instanceof Error ? err.message : 'Unable to join room');
      }
    },
    [p1Config],
  );

  const handleLeaveRoom = useCallback(() => {
    netClientRef.current?.leaveRoom();
    setOnlineRoom(null);
    setRoomError(null);
    actionsRef.current?.returnToTitle();
  }, []);

  const handleUpdateP1 = useCallback(
    (next: BuggyConfig) => {
      setP1Config(next);
      if (onlineRoom) {
        netClientRef.current?.updateConfig(next);
      }
    },
    [onlineRoom],
  );

  const handleSendOnlineInput = useCallback((input: PlayerControlInput) => {
    netClientRef.current?.sendInput(input);
  }, []);

  const isOnlineHost = Boolean(onlineRoom && myClientId && onlineRoom.hostId === myClientId);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0d1017]">
      <GameCanvas
        phase={phase}
        mode={effectiveMode}
        trackId={trackId}
        distanceKm={distanceKm}
        maxOpponents={maxOpponents}
        p1Config={p1Config}
        p2Config={p2Config}
        garageOpen={garageOpen}
        onSendOnlineInput={handleSendOnlineInput}
        onHudUpdate={setHud}
        onPhaseChange={handlePhaseChange}
        onMuteChange={setMuted}
        actionsRef={actionsRef}
      />

      {phase === 'title' && !garageOpen && !leaderboardOpen && !onlineRoom && (
        <TitleOverlay
          mainMode={mainMode}
          multiplayerKind={multiplayerKind}
          trackId={trackId}
          distanceKm={distanceKm}
          maxOpponents={maxOpponents}
          joinKeyInput={joinKeyInput}
          roomError={roomError}
          connectingRoom={connectingRoom}
          onMainModeChange={handleMainModeChange}
          onMultiplayerKindChange={(k) => {
            setMultiplayerKind(k);
            setRoomError(null);
          }}
          onTrackChange={setTrackId}
          onDistanceChange={setDistanceKm}
          onMaxOpponentsChange={setMaxOpponents}
          onJoinKeyChange={setJoinKeyInput}
          onStartLocalRace={handleStartLocalRace}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          onOpenGarage={() => setGarageOpen(true)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
        />
      )}

      {phase === 'title' && !garageOpen && !leaderboardOpen && onlineRoom && (
        <OnlineLobbyPanel
          room={onlineRoom}
          myClientId={myClientId}
          errorMsg={roomError}
          onUpdateSettings={(params) => netClientRef.current?.updateSettings(params)}
          onStartRace={() => netClientRef.current?.startRace()}
          onOpenGarage={() => setGarageOpen(true)}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {phase === 'title' && garageOpen && (
        <GaragePanel
          mode={effectiveMode}
          inOnlineLobby={Boolean(onlineRoom)}
          p1Config={p1Config}
          p2Config={p2Config}
          onUpdateP1={handleUpdateP1}
          onUpdateP2={setP2Config}
          onClose={() => setGarageOpen(false)}
          onPrimaryAction={() => {
            if (onlineRoom) {
              setGarageOpen(false);
            } else {
              handleStartLocalRace();
            }
          }}
        />
      )}

      {phase !== 'title' && hud && (
        <RaceHud
          hud={hud}
          muted={muted}
          savedRank={savedRank}
          isOnlineHost={isOnlineHost}
          showGameOverModal={showPostRaceModal}
          onTouchInput={(partial) => actionsRef.current?.setTouchInput(partial)}
          onPause={() => actionsRef.current?.pauseRace()}
          onResume={() => actionsRef.current?.resumeRace()}
          onRestart={handleRestartRace}
          onExitToTitle={() => {
            if (effectiveMode === 'online') {
              handleLeaveRoom();
            } else {
              actionsRef.current?.returnToTitle();
            }
          }}
          onReturnLobby={() => netClientRef.current?.returnToLobby()}
          onToggleMute={() => actionsRef.current?.toggleMute()}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
        />
      )}

      {leaderboardOpen && (
        <LeaderboardModal
          entries={leaderboard}
          initialTrackId={trackId}
          initialDistanceKm={distanceKm}
          onReset={() => setLeaderboard(resetLeaderboard())}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}
    </main>
  );
}
