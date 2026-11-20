import React, { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { computeBuggyStats } from '../game/physics';
import {
  BuggyConfig,
  CHASSIS_OPTIONS,
  PAINT_SWATCHES,
  PlayMode,
  RIG_OPTIONS,
  TIRE_OPTIONS,
} from '../game/types';

interface GaragePanelProps {
  mode: PlayMode;
  inOnlineLobby?: boolean;
  p1Config: BuggyConfig;
  p2Config: BuggyConfig;
  onUpdateP1: (next: BuggyConfig) => void;
  onUpdateP2: (next: BuggyConfig) => void;
  onClose: () => void;
  onPrimaryAction: () => void;
}

export const GaragePanel: React.FC<GaragePanelProps> = ({
  mode,
  inOnlineLobby = false,
  p1Config,
  p2Config,
  onUpdateP1,
  onUpdateP2,
  onClose,
  onPrimaryAction,
}) => {
  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const resolvedSlot = mode === 'splitscreen' ? activeSlot : 'p1';
  const current = resolvedSlot === 'p1' ? p1Config : p2Config;
  const setCurrent = resolvedSlot === 'p1' ? onUpdateP1 : onUpdateP2;
  const stats = computeBuggyStats(current);

  const speedPct = Math.round(((stats.topSpeed - 33) / 10) * 100);
  const accelPct = Math.round(((stats.acceleration - 21) / 8) * 100);
  const handlePct = Math.round(((stats.handling - 2.0) / 0.8) * 100);
  const offroadPct = Math.round(((stats.offroadGrip - 0.78) / 0.48) * 100);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-start p-5 md:p-8">
      <div className="pointer-events-auto hud-panel rounded-xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-slate-200 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h2 className="font-display font-bold text-lg text-white">Buggy Garage</h2>
        </div>

        {/* Player 1 / Player 2 Switcher (Split-Screen only) */}
        {mode === 'splitscreen' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#090c12] border border-white/10">
            <button
              type="button"
              onClick={() => setActiveSlot('p1')}
              className={`py-2 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                resolvedSlot === 'p1'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Player 1
            </button>
            <button
              type="button"
              onClick={() => setActiveSlot('p2')}
              className={`py-2 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                resolvedSlot === 'p2'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Player 2
            </button>
          </div>
        )}

        {/* Driver Name */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="garage-driver-name"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Driver Name
          </label>
          <input
            id="garage-driver-name"
            type="text"
            maxLength={16}
            value={current.name}
            onChange={(e) => setCurrent({ ...current, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[#090c12] border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-orange-400"
          />
        </div>

        {/* Paint Livery */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Paint Livery
          </span>
          <div className="flex items-center gap-2.5">
            {PAINT_SWATCHES.map((sw) => {
              const selected = current.colorHex === sw.hex;
              return (
                <button
                  key={sw.id}
                  type="button"
                  aria-label={`Paint ${sw.name}`}
                  onClick={() =>
                    setCurrent({ ...current, colorHex: sw.hex, accentHex: sw.accent })
                  }
                  className={`w-9 h-9 rounded-lg border-2 transition-transform cursor-pointer ${
                    selected ? 'border-white scale-110' : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              );
            })}
          </div>
        </div>

        {/* Chassis Frame */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chassis Frame
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {CHASSIS_OPTIONS.map((ch) => {
              const selected = current.chassis === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setCurrent({ ...current, chassis: ch.id })}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/20 border-orange-400 text-white'
                      : 'bg-[#090c12]/70 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold leading-tight">{ch.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{ch.role}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tires */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Off-Road Tires
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {TIRE_OPTIONS.map((t) => {
              const selected = current.tires === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCurrent({ ...current, tires: t.id })}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/20 border-orange-400 text-white'
                      : 'bg-[#090c12]/70 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold leading-tight">{t.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{t.role}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Roof / Rear Rig */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Roof & Rear Rig
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {RIG_OPTIONS.map((r) => {
              const selected = current.rig === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCurrent({ ...current, rig: r.id })}
                  className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/20 border-orange-400 text-white'
                      : 'bg-[#090c12]/70 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold">{r.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stat Bars */}
        <div className="pt-1 border-t border-white/10 grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: 'Top Speed', val: speedPct },
            { label: 'Acceleration', val: accelPct },
            { label: 'Handling', val: handlePct },
            { label: 'Off-Road Grip', val: offroadPct },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>{stat.label}</span>
                <span className="font-mono-num">{Math.max(15, Math.min(100, stat.val))}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full"
                  style={{ width: `${Math.max(15, Math.min(100, stat.val))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{inOnlineLobby ? 'Save & Return to Room' : 'Race Now'}</span>
        </button>
      </div>
    </div>
  );
};
