import React from 'react';
import { Globe, KeyRound, Play, SlidersHorizontal, Trophy, Users } from 'lucide-react';
import { TRACK_LIST } from '../game/tracks';
import {
  DISTANCE_OPTIONS,
  MainMode,
  MultiplayerKind,
  TrackDistanceKm,
  TrackId,
} from '../game/types';
import { TitleLogoSvg } from './SvgIcons';

interface TitleOverlayProps {
  mainMode: MainMode;
  multiplayerKind: MultiplayerKind;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  maxOpponents: number;
  joinKeyInput: string;
  roomError: string | null;
  connectingRoom: boolean;
  onMainModeChange: (next: MainMode) => void;
  onMultiplayerKindChange: (next: MultiplayerKind) => void;
  onTrackChange: (trackId: TrackId) => void;
  onDistanceChange: (km: TrackDistanceKm) => void;
  onMaxOpponentsChange: (count: number) => void;
  onJoinKeyChange: (val: string) => void;
  onStartLocalRace: () => void;
  onCreateOnlineRoom: () => void;
  onJoinOnlineRoom: (key: string) => void;
  onOpenGarage: () => void;
  onOpenLeaderboard: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  mainMode,
  multiplayerKind,
  trackId,
  distanceKm,
  maxOpponents,
  joinKeyInput,
  roomError,
  connectingRoom,
  onMainModeChange,
  onMultiplayerKindChange,
  onTrackChange,
  onDistanceChange,
  onMaxOpponentsChange,
  onJoinKeyChange,
  onStartLocalRace,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenGarage,
  onOpenLeaderboard,
}) => {
  const isOnlineSetup = mainMode === 'multiplayer' && multiplayerKind === 'online';
  const opponentChoices = mainMode === 'multiplayer' ? [2, 3, 4, 5] : [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6 overflow-y-auto">
      {/* Upper-left Title Lockup & Race Setup */}
      <div className="max-w-[445px] pointer-events-auto flex flex-col gap-2.5">
        <TitleLogoSvg className="w-full max-w-[330px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]" />

        <div className="hud-panel rounded-xl p-3.5 flex flex-col gap-2.5">
          {/* Solo vs Multiplayer */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#090c12] border border-white/10">
            <button
              type="button"
              onClick={() => onMainModeChange('solo')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                mainMode === 'solo'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => onMainModeChange('multiplayer')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                mainMode === 'multiplayer'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Multiplayer
            </button>
          </div>

          {/* Multiplayer Sub-mode + Max Opponents (2..5) */}
          {mainMode === 'multiplayer' ? (
            <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-[#090c12]/75 border border-white/10">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onMultiplayerKindChange('online')}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    multiplayerKind === 'online'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Online (Key)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMultiplayerKindChange('splitscreen')}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    multiplayerKind === 'splitscreen'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Split-Screen</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Max Opponents (2–5)
                </span>
                <div className="flex items-center gap-1">
                  {opponentChoices.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onMaxOpponentsChange(cnt)}
                      className={`w-8 py-1 rounded text-xs font-bold font-mono-num border transition-colors cursor-pointer ${
                        maxOpponents === cnt
                          ? 'bg-orange-500 border-orange-400 text-slate-950'
                          : 'bg-[#090c12] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                AI Opponents
              </span>
              <div className="flex items-center gap-1">
                {opponentChoices.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onMaxOpponentsChange(cnt)}
                    className={`w-8 py-1 rounded text-xs font-bold font-mono-num border transition-colors cursor-pointer ${
                      maxOpponents === cnt
                        ? 'bg-orange-500 border-orange-400 text-slate-950'
                        : 'bg-[#090c12] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track Distance (2km, 3km, 5km) */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Track Distance
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {DISTANCE_OPTIONS.map((opt) => {
                const selected = distanceKm === opt.km;
                return (
                  <button
                    key={opt.km}
                    type="button"
                    onClick={() => onDistanceChange(opt.km)}
                    className={`py-1.5 rounded-lg border text-xs font-bold font-mono-num transition-colors cursor-pointer ${
                      selected
                        ? 'bg-orange-500 border-orange-400 text-slate-950'
                        : 'bg-[#090c12]/80 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Off-Road Track Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {distanceKm} km Off-Road Track
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {TRACK_LIST.map((track) => {
                const selected = track.id === trackId;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onTrackChange(track.id)}
                    className={`text-left px-2.5 py-2 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-0.5 ${
                      selected
                        ? 'bg-orange-500/18 border-orange-400 text-white'
                        : 'bg-[#090c12]/70 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    <div className="font-display font-bold text-xs leading-tight truncate">
                      {track.name}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 truncate">
                      {track.difficulty}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Action Area */}
          {isOnlineSetup ? (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                type="button"
                disabled={connectingRoom}
                onClick={onCreateOnlineRoom}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{connectingRoom ? 'Connecting...' : 'Create Room & Get Key'}</span>
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinKeyInput.trim()) onJoinOnlineRoom(joinKeyInput);
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Enter Joining Key"
                  value={joinKeyInput}
                  onChange={(e) => onJoinKeyChange(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#090c12] border border-white/15 text-white font-mono-num font-bold text-sm tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={connectingRoom || !joinKeyInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-display font-bold text-sm cursor-pointer shrink-0"
                >
                  Join
                </button>
              </form>

              {roomError && (
                <div className="px-3 py-1.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 font-medium">
                  {roomError}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onStartLocalRace}
              className="w-full py-2.5 px-5 rounded-lg bg-orange-500 hover:bg-orange-400 active:translate-y-px text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {mainMode === 'multiplayer'
                  ? `Start ${distanceKm} km Split-Screen`
                  : `Start ${distanceKm} km Solo Race`}
              </span>
            </button>
          )}

          {/* Garage / Leaderboard */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenGarage}
              className="py-1.5 px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-orange-400" />
              <span>Customize</span>
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-1.5 px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single flat borderless control hint line */}
      <div className="w-full flex justify-center pointer-events-none pt-1">
        <p className="px-4 py-1 rounded-md bg-[#090c12]/72 text-xs md:text-sm font-medium text-slate-100 text-center tracking-wide">
          {mainMode === 'multiplayer' && multiplayerKind === 'splitscreen'
            ? 'P1: WASD Drive · Space Item · Shift Boost  ·  P2: Arrows Drive · Enter Item · / Boost  ·  Esc Pause'
            : 'WASD or Arrows Drive · Space Item · Shift Boost · Esc Pause'}
        </p>
      </div>
    </div>
  );
};
