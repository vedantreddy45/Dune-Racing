import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX, Zap } from 'lucide-react';
import { formatRaceTime } from '../game/leaderboard';
import { TRACKS } from '../game/tracks';
import {
  HudSnapshot,
  POWERUP_INFO,
  PlayerHudSnapshot,
} from '../game/types';
import { PowerUpIconSvg } from './SvgIcons';

interface RaceHudProps {
  hud: HudSnapshot;
  muted: boolean;
  savedRank: number | null;
  isOnlineHost?: boolean;
  showGameOverModal?: boolean;
  onTouchInput?: (partial: {
    throttle?: number;
    steer?: number;
    boost?: boolean;
    triggerItem?: boolean;
  }) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
  onReturnLobby?: () => void;
  onToggleMute: () => void;
  onOpenLeaderboard: () => void;
}

function ordinal(n: number): string {
  if (n === 1) return '1ST';
  if (n === 2) return '2ND';
  if (n === 3) return '3RD';
  return `${n}TH`;
}

const PlayerViewportHud: React.FC<{
  player: PlayerHudSnapshot;
  totalRacers: number;
  lengthMeters: number;
  playerIndex: number;
  isSplit: boolean;
}> = ({ player, totalRacers, lengthMeters, playerIndex, isSplit }) => {
  const accentBorder = playerIndex === 0 ? 'border-orange-400/70' : 'border-sky-400/70';
  const accentText = playerIndex === 0 ? 'text-orange-400' : 'text-sky-400';
  const accentBar = playerIndex === 0 ? 'bg-orange-500' : 'bg-sky-400';
  const itemKey = playerIndex === 0 ? 'SPACE' : 'ENTER';
  const boostKey = playerIndex === 0 ? 'SHIFT' : '/';
  const progressPct = Math.min(100, (player.distanceMeters / Math.max(1, lengthMeters)) * 100);
  const itemMeta = player.heldPowerUp ? POWERUP_INFO[player.heldPowerUp] : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3.5 md:p-5">
      {/* Top-Left Cluster: Rank + Dynamic Distance */}
      <div className="flex items-start justify-between">
        <div className={`hud-panel rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 border-l-0 ${accentBorder} flex flex-col gap-1 min-w-[132px] sm:min-w-[180px]`}>
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <span className={`font-display font-bold text-xl sm:text-2xl leading-none ${accentText}`}>
              {ordinal(player.rank)}
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 ml-1">/{totalRacers}</span>
            </span>
            <span className="hidden sm:inline text-xs font-bold text-slate-200 tracking-wide">
              {player.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 font-mono-num">
            <span>{player.distanceMeters.toLocaleString()} m</span>
            <span className="text-slate-500">/ {lengthMeters.toLocaleString()} m</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
            <div
              className={`h-full ${accentBar} rounded-full`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {isSplit && player.finished && (
          <div className="hud-panel rounded-lg px-4 py-2 text-center">
            <div className="font-display font-bold text-lg text-emerald-400">
              FINISHED · {ordinal(player.rank)}
            </div>
            <div className="font-mono-num text-xs text-slate-200">
              {formatRaceTime(player.finishTime)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Clusters: Left Power-Up Socket & Right Speed + Boost */}
      <div className="flex items-end justify-between gap-4">
        <div className="hud-panel rounded-lg px-3 py-2 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-md bg-[#090c12] border border-white/15 flex items-center justify-center shrink-0">
            <PowerUpIconSvg type={player.heldPowerUp} className="w-7 h-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white leading-tight">
              {itemMeta ? itemMeta.name : 'No Item'}
            </span>
            <span className="text-[11px] text-slate-400 leading-tight">
              {itemMeta ? `${itemMeta.shortDesc} · [${itemKey}]` : 'Hit crystal pods'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {player.nitroActive && (
            <span className="px-2.5 py-1 rounded bg-orange-500 text-slate-950 font-display font-bold text-xs">
              NITRO
            </span>
          )}
          {player.shieldActive && (
            <span className="px-2.5 py-1 rounded bg-sky-400 text-slate-950 font-display font-bold text-xs">
              SHIELD
            </span>
          )}
          {player.spinOutActive && (
            <span className="px-2.5 py-1 rounded bg-purple-500 text-white font-display font-bold text-xs">
              OIL SLIP
            </span>
          )}
        </div>

        <div className="hud-panel rounded-lg px-3.5 py-2 flex flex-col items-end gap-1 min-w-[138px]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-3xl leading-none text-white font-mono-num">
              {player.speedKmh}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">KM/H</span>
          </div>
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">
              Boost [{boostKey}]
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/12 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${player.boostMeter}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RaceHud: React.FC<RaceHudProps> = ({
  hud,
  muted,
  savedRank,
  isOnlineHost = false,
  showGameOverModal = true,
  onTouchInput,
  onPause,
  onResume,
  onRestart,
  onExitToTitle,
  onReturnLobby,
  onToggleMute,
  onOpenLeaderboard,
}) => {
  const isSplit = hud.mode === 'splitscreen' && hud.players.length >= 2;
  const isOnline = hud.mode === 'online';
  const track = TRACKS[hud.trackId];

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    setIsTouchDevice(Boolean(coarse));
  }, []);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      {isSplit ? (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <PlayerViewportHud
              player={hud.players[0]}
              totalRacers={hud.totalRacers}
              lengthMeters={hud.lengthMeters}
              playerIndex={0}
              isSplit
            />
          </div>
          <div className="h-[3px] w-full bg-[#090c12] border-y border-white/20 shrink-0" />
          <div className="flex-1 min-h-0">
            <PlayerViewportHud
              player={hud.players[1]}
              totalRacers={hud.totalRacers}
              lengthMeters={hud.lengthMeters}
              playerIndex={1}
              isSplit
            />
          </div>
        </div>
      ) : (
        hud.players[0] && (
          <PlayerViewportHud
            player={hud.players[0]}
            totalRacers={hud.totalRacers}
            lengthMeters={hud.lengthMeters}
            playerIndex={0}
            isSplit={false}
          />
        )
      )}

      {/* Global Top-Right Clock & Utility Buttons */}
      <div className="fixed top-3.5 right-3.5 md:top-5 md:right-5 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
        <div className="hud-panel rounded-lg px-2.5 py-1.5 sm:px-3 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:inline">
            {track.name} · {hud.distanceKm} km
          </span>
          <span
            data-testid="race-timer"
            className="font-mono-num font-bold text-xs sm:text-sm md:text-base text-white"
          >
            {formatRaceTime(hud.elapsedTime)}
          </span>
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="hud-panel w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-slate-200 hover:text-white hover:border-white/30 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {!isOnline && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart Race"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="hud-panel w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-slate-200 hover:text-white hover:border-white/30 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause Game"
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="hud-panel w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-slate-200 hover:text-white hover:border-white/30 cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Countdown Banner (3 - 2 - 1 - GO!) */}
      {hud.phase === 'playing' && hud.countdownValue >= 0 && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-display font-bold text-7xl md:text-8xl text-orange-400 hud-text-shadow">
            {hud.countdownValue === 0 ? 'GO!' : hud.countdownValue}
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 pointer-events-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Race Paused"
            className="hud-panel rounded-xl w-full max-w-sm p-6 flex flex-col gap-4"
          >
            <div className="text-center">
              <h2 className="font-display font-bold text-2xl text-white">
                {isOnline ? 'Race Menu' : 'Race Paused'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {track.name} · {hud.distanceKm} km · {formatRaceTime(hud.elapsedTime)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Race</span>
              </button>
              {!isOnline && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-slate-100 text-sm font-semibold cursor-pointer"
                >
                  Restart {hud.distanceKm} km Run
                </button>
              )}
              <button
                type="button"
                onClick={onExitToTitle}
                className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium cursor-pointer"
              >
                {isOnline ? 'Leave Online Room' : 'Exit to Title'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile / Touch Browser Controls (shown on coarse-pointer touch screens during active single-viewport play) */}
      {isTouchDevice && hud.phase === 'playing' && !isSplit && onTouchInput && (
        <div className="fixed inset-x-3 bottom-24 flex items-end justify-between gap-2 pointer-events-none select-none touch-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              aria-label="Steer Left"
              onPointerDown={() => onTouchInput({ steer: 1 })}
              onPointerUp={() => onTouchInput({ steer: 0 })}
              onPointerLeave={() => onTouchInput({ steer: 0 })}
              onPointerCancel={() => onTouchInput({ steer: 0 })}
              className="hud-panel w-12 h-12 rounded-xl flex items-center justify-center text-white active:bg-orange-500 active:text-slate-950 touch-none"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              aria-label="Steer Right"
              onPointerDown={() => onTouchInput({ steer: -1 })}
              onPointerUp={() => onTouchInput({ steer: 0 })}
              onPointerLeave={() => onTouchInput({ steer: 0 })}
              onPointerCancel={() => onTouchInput({ steer: 0 })}
              className="hud-panel w-12 h-12 rounded-xl flex items-center justify-center text-white active:bg-orange-500 active:text-slate-950 touch-none"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-end gap-1.5 pointer-events-auto">
            <button
              type="button"
              aria-label="Use Item"
              onPointerDown={() => onTouchInput({ triggerItem: true })}
              className="hud-panel w-10 h-11 rounded-xl flex items-center justify-center text-sky-400 active:bg-sky-500 active:text-slate-950 touch-none"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Boost"
              onPointerDown={() => onTouchInput({ boost: true, throttle: 1 })}
              onPointerUp={() => onTouchInput({ boost: false, throttle: 0 })}
              onPointerLeave={() => onTouchInput({ boost: false, throttle: 0 })}
              onPointerCancel={() => onTouchInput({ boost: false, throttle: 0 })}
              className="hud-panel w-10 h-11 rounded-xl flex items-center justify-center text-amber-400 active:bg-amber-400 active:text-slate-950 touch-none"
            >
              <Flame className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Brake or Reverse"
              onPointerDown={() => onTouchInput({ throttle: -1 })}
              onPointerUp={() => onTouchInput({ throttle: 0 })}
              onPointerLeave={() => onTouchInput({ throttle: 0 })}
              onPointerCancel={() => onTouchInput({ throttle: 0 })}
              className="hud-panel px-2.5 h-11 rounded-xl font-display font-bold text-xs text-slate-200 active:bg-rose-500 active:text-white touch-none"
            >
              BRK
            </button>
            <button
              type="button"
              aria-label="Gas"
              onPointerDown={() => onTouchInput({ throttle: 1 })}
              onPointerUp={() => onTouchInput({ throttle: 0 })}
              onPointerLeave={() => onTouchInput({ throttle: 0 })}
              onPointerCancel={() => onTouchInput({ throttle: 0 })}
              className="w-14 h-12 rounded-xl bg-orange-500 text-slate-950 font-display font-bold text-sm active:bg-orange-400 touch-none"
            >
              GAS
            </button>
          </div>
        </div>
      )}

      {/* 2-Second Post-Finish Banner while cars rest cleanly on the finish line */}
      {hud.phase === 'gameover' && !showGameOverModal && (
        <div className="fixed inset-x-0 top-16 flex justify-center p-4 pointer-events-none">
          <div className="hud-panel rounded-xl px-6 py-3 text-center border-orange-400/60">
            <div className="font-display font-bold text-2xl md:text-3xl text-orange-400 tracking-wide">
              CHECKERED FLAG · {hud.distanceKm} KM FINISHED
            </div>
            <div className="text-xs md:text-sm text-slate-200 mt-0.5">
              Winner: <span className="font-bold text-white">{hud.standings[0]?.label ?? 'Driver'}</span>
              {' · '}
              <span className="font-mono-num text-amber-300">
                {formatRaceTime(hud.standings[0]?.finishTime ?? hud.elapsedTime)}
              </span>
              {' · Opening Leaderboard...'}
            </div>
          </div>
        </div>
      )}

      {/* Victory / Finish Modal (shown after 2s post-finish delay) */}
      {hud.phase === 'gameover' && showGameOverModal && (
        <div className="fixed inset-0 bg-black/68 flex items-center justify-center p-4 pointer-events-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Race Results"
            className="hud-panel rounded-xl w-full max-w-lg p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-2xl text-white">
                  {hud.distanceKm} km Checkered Flag
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {track.name} · Winner: {hud.standings[0]?.label ?? 'Driver'}
                </p>
              </div>
              {savedRank !== null && (
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">Leaderboard Saved</div>
                  <div className="text-xs text-slate-300 font-mono-num">
                    {hud.distanceKm} km Rank #{savedRank}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-[#090c12]/80 overflow-hidden max-h-[42vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-3 w-12">Pos</th>
                    <th className="py-2 px-3">Driver</th>
                    <th className="py-2 px-3 text-right">Distance</th>
                    <th className="py-2 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {hud.standings.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-white/5 last:border-b-0 text-sm ${
                        row.isHuman ? 'bg-white/4 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono-num font-bold text-slate-200">
                        {ordinal(row.rank)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm inline-block"
                            style={{ backgroundColor: row.colorHex }}
                          />
                          <span className="text-white">{row.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-xs text-slate-400">
                        {row.distanceMeters.toLocaleString()} m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-bold text-orange-400">
                        {row.finishTime !== null ? formatRaceTime(row.finishTime) : 'FINISHED'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {isOnline ? (
                isOnlineHost && onReturnLobby ? (
                  <button
                    type="button"
                    onClick={onReturnLobby}
                    className="col-span-1 py-2.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
                  >
                    Room Lobby
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onExitToTitle}
                    className="col-span-1 py-2.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
                  >
                    Leave Room
                  </button>
                )
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={onRestart}
                  className="col-span-1 py-2.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
                >
                  Race Again
                </button>
              )}
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="col-span-1 py-2.5 px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-slate-100 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Leaderboard</span>
              </button>
              <button
                type="button"
                onClick={onExitToTitle}
                className="col-span-1 py-2.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium cursor-pointer"
              >
                Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
