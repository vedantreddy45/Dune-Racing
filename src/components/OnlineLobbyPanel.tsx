import React, { useState } from 'react';
import { Check, Copy, LogOut, Play, SlidersHorizontal, Users } from 'lucide-react';
import { TRACK_LIST } from '../game/tracks';
import {
  DISTANCE_OPTIONS,
  RoomStateInfo,
  TrackDistanceKm,
  TrackId,
} from '../game/types';

interface OnlineLobbyPanelProps {
  room: RoomStateInfo;
  myClientId: string | null;
  errorMsg: string | null;
  onUpdateSettings: (params: {
    trackId: TrackId;
    distanceKm: TrackDistanceKm;
    maxOpponents: number;
    fillWithAi: boolean;
  }) => void;
  onStartRace: () => void;
  onOpenGarage: () => void;
  onLeaveRoom: () => void;
}

export const OnlineLobbyPanel: React.FC<OnlineLobbyPanelProps> = ({
  room,
  myClientId,
  errorMsg,
  onUpdateSettings,
  onStartRace,
  onOpenGarage,
  onLeaveRoom,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isHost = myClientId !== null && room.hostId === myClientId;
  const maxGridSize = 1 + room.maxOpponents;
  const aiCount = room.fillWithAi ? Math.max(0, maxGridSize - room.members.length) : 0;

  const copyRoomKey = async () => {
    try {
      await navigator.clipboard.writeText(room.roomKey);
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 1800);
    } catch {
      setCopiedKey(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      const url = `${window.location.origin}/?room=${room.roomKey}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-start p-5 md:p-10">
      <div className="pointer-events-auto hud-panel rounded-xl w-full max-w-[470px] max-h-[92vh] overflow-y-auto p-5 flex flex-col gap-4">
        {/* Header + Leave */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl text-white">Multiplayer Room</h2>
            <p className="text-xs text-slate-400">
              Share the Joining Key so other devices can race with you
            </p>
          </div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-rose-500/20 border border-white/10 text-slate-200 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Joining Key Box */}
        <div className="rounded-lg bg-[#090c12] border border-orange-400/50 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Joining Key
              </div>
              <div
                data-testid="room-joining-key"
                className="font-mono-num font-bold text-3xl tracking-[0.22em] text-orange-400 leading-tight mt-0.5"
              >
                {room.roomKey}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={copyRoomKey}
                className="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-3 py-1.5 rounded-md bg-white/8 hover:bg-white/14 border border-white/12 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Invite Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-xs text-rose-200 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Connected Racers */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span>
                Drivers ({room.members.length}/{maxGridSize} devices{aiCount > 0 ? ` + ${aiCount} AI` : ''})
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenGarage}
              className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 normal-case font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize My Buggy</span>
            </button>
          </div>

          <div className="rounded-lg bg-[#090c12]/80 border border-white/10 divide-y divide-white/8 max-h-40 overflow-y-auto">
            {room.members.map((m, idx) => {
              const isMe = m.clientId === myClientId;
              return (
                <div
                  key={m.clientId}
                  className="px-3 py-2 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: m.config.colorHex }}
                    />
                    <span className="font-semibold text-white truncate">
                      {m.config.name || `PLAYER ${idx + 1}`}
                    </span>
                    {isMe && (
                      <span className="text-[11px] font-bold text-orange-400">(YOU)</span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    {m.isHost ? 'Host' : `Slot ${idx + 1}`}
                  </span>
                </div>
              );
            })}
            {aiCount > 0 && (
              <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-400">
                <span>+ {aiCount} AI Rival {aiCount === 1 ? 'Buggy' : 'Buggies'}</span>
                <span>Auto-filled</span>
              </div>
            )}
          </div>
        </div>

        {/* Host Race Settings */}
        <div className="flex flex-col gap-3 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Race Settings
            </span>
            {!isHost && (
              <span className="text-[11px] text-slate-400">Controlled by Host</span>
            )}
          </div>

          {/* Distance */}
          <div className="grid grid-cols-3 gap-1.5">
            {DISTANCE_OPTIONS.map((opt) => {
              const selected = room.distanceKm === opt.km;
              return (
                <button
                  key={opt.km}
                  type="button"
                  disabled={!isHost}
                  onClick={() =>
                    onUpdateSettings({
                      trackId: room.trackId,
                      distanceKm: opt.km,
                      maxOpponents: room.maxOpponents,
                      fillWithAi: room.fillWithAi,
                    })
                  }
                  className={`py-2 rounded-md border text-xs font-bold transition-colors ${
                    selected
                      ? 'bg-orange-500 border-orange-400 text-slate-950'
                      : 'bg-[#090c12]/80 border-white/10 text-slate-300'
                  } ${isHost ? 'cursor-pointer hover:border-white/30' : 'opacity-80 cursor-default'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Track */}
          <div className="grid grid-cols-3 gap-1.5">
            {TRACK_LIST.map((t) => {
              const selected = room.trackId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() =>
                    onUpdateSettings({
                      trackId: t.id,
                      distanceKm: room.distanceKm,
                      maxOpponents: room.maxOpponents,
                      fillWithAi: room.fillWithAi,
                    })
                  }
                  className={`p-2 rounded-md border text-left transition-colors ${
                    selected
                      ? 'bg-orange-500/20 border-orange-400 text-white'
                      : 'bg-[#090c12]/80 border-white/10 text-slate-300'
                  } ${isHost ? 'cursor-pointer hover:border-white/30' : 'opacity-80 cursor-default'}`}
                >
                  <div className="text-xs font-bold truncate">{t.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-slate-400 truncate">{t.difficulty}</div>
                </button>
              );
            })}
          </div>

          {/* Max Opponents (2..5) & AI Fill */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Max Opponents
              </span>
              <div className="grid grid-cols-4 gap-1">
                {[2, 3, 4, 5].map((cnt) => {
                  const selected = room.maxOpponents === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      disabled={!isHost}
                      onClick={() =>
                        onUpdateSettings({
                          trackId: room.trackId,
                          distanceKm: room.distanceKm,
                          maxOpponents: cnt,
                          fillWithAi: room.fillWithAi,
                        })
                      }
                      className={`py-1.5 rounded border text-xs font-bold font-mono-num ${
                        selected
                          ? 'bg-orange-500 border-orange-400 text-slate-950'
                          : 'bg-[#090c12]/80 border-white/10 text-slate-300'
                      } ${isHost ? 'cursor-pointer' : 'opacity-80 cursor-default'}`}
                    >
                      {cnt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1 items-end">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Empty Slots
              </span>
              <button
                type="button"
                disabled={!isHost}
                onClick={() =>
                  onUpdateSettings({
                    trackId: room.trackId,
                    distanceKm: room.distanceKm,
                    maxOpponents: room.maxOpponents,
                    fillWithAi: !room.fillWithAi,
                  })
                }
                className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                  room.fillWithAi
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-[#090c12]/80 border-white/10 text-slate-300'
                } ${isHost ? 'cursor-pointer' : 'opacity-80 cursor-default'}`}
              >
                {room.fillWithAi ? 'Fill with AI' : 'Humans Only'}
              </button>
            </div>
          </div>
        </div>

        {/* Start CTA */}
        {isHost ? (
          <button
            type="button"
            data-start="true"
            onClick={onStartRace}
            className="w-full py-3 px-5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-lg tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start {room.distanceKm} km Online Race</span>
          </button>
        ) : (
          <div className="w-full py-3 px-4 rounded-lg bg-white/6 border border-white/10 text-center text-sm font-semibold text-slate-200">
            Waiting for host to start {room.distanceKm} km race...
          </div>
        )}
      </div>
    </div>
  );
};
