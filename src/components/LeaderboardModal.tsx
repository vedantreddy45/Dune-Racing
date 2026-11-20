import React, { useState } from 'react';
import { RotateCcw, Trophy, X } from 'lucide-react';
import { formatRaceTime, sortLeaderboardForTrack } from '../game/leaderboard';
import { TRACK_LIST } from '../game/tracks';
import {
  DISTANCE_OPTIONS,
  LeaderboardEntry,
  TrackDistanceKm,
  TrackId,
} from '../game/types';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  initialTrackId: TrackId;
  initialDistanceKm: TrackDistanceKm;
  onReset: () => void;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  entries,
  initialTrackId,
  initialDistanceKm,
  onReset,
  onClose,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<TrackId>(initialTrackId);
  const [selectedDistance, setSelectedDistance] = useState<TrackDistanceKm>(initialDistanceKm);
  const trackEntries = sortLeaderboardForTrack(entries, selectedTrack, selectedDistance);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Track Time Leaderboard"
        className="hud-panel rounded-xl w-full max-w-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-display font-bold text-xl text-white">
              Time Leaderboard
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close Leaderboard"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track & Distance Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-1 p-1 rounded-lg bg-[#090c12] border border-white/10 overflow-x-auto">
            {TRACK_LIST.map((t) => {
              const active = t.id === selectedTrack;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTrack(t.id)}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090c12] border border-white/10 shrink-0">
            {DISTANCE_OPTIONS.map((d) => {
              const active = d.km === selectedDistance;
              return (
                <button
                  key={d.km}
                  type="button"
                  onClick={() => setSelectedDistance(d.km)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ranked Standings Table */}
        <div className="rounded-lg border border-white/10 bg-[#090c12]/80 overflow-hidden max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3 w-14">Rank</th>
                <th className="py-2.5 px-3">Driver</th>
                <th className="py-2.5 px-3">Buggy</th>
                <th className="py-2.5 px-3 w-20">Mode</th>
                <th className="py-2.5 px-3 text-right">{selectedDistance} km Time</th>
              </tr>
            </thead>
            <tbody>
              {trackEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    No {selectedDistance} km runs recorded on this track yet.
                  </td>
                </tr>
              ) : (
                trackEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-b border-white/5 last:border-b-0 text-sm hover:bg-white/4"
                  >
                    <td className="py-2.5 px-3 font-mono-num font-bold text-slate-300">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                          style={{ backgroundColor: entry.colorHex }}
                        />
                        <span>{entry.driverName}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs">{entry.vehicleLabel}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase">
                      {entry.mode === 'splitscreen' ? '2P Split' : entry.mode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-bold text-orange-400">
                      {formatRaceTime(entry.timeSeconds)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/12 border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Records</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold text-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
