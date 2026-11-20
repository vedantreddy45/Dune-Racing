import React from 'react';
import { PowerUpType } from '../game/types';

export function TitleLogoSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 490 96"
      className={className}
      role="img"
      aria-label="Dune Runners"
    >
      <defs>
        <linearGradient id="dr-stripe" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>
      {/* Emblem wheel / canyon badge */}
      <g transform="translate(8, 12)">
        <polygon
          points="36,2 68,20 68,56 36,74 4,56 4,20"
          fill="#111827"
          stroke="#f97316"
          strokeWidth="3.5"
        />
        <circle cx="36" cy="38" r="19" fill="none" stroke="#f8fafc" strokeWidth="3" strokeDasharray="8 4" />
        <circle cx="36" cy="38" r="7" fill="url(#dr-stripe)" />
        <path d="M10 56 L62 20" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      </g>
      {/* Title typography */}
      <text
        x="92"
        y="50"
        fill="#f8fafc"
        fontFamily="Chakra Petch, sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="40"
        letterSpacing="1.5"
        stroke="#090d16"
        strokeWidth="5"
        paintOrder="stroke fill"
      >
        DUNE RUNNERS
      </text>
      <rect x="94" y="61" width="176" height="5" rx="2" fill="url(#dr-stripe)" />
      <text
        x="94"
        y="83"
        fill="#cbd5e1"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
        fontSize="14"
        letterSpacing="2.4"
        stroke="#090d16"
        strokeWidth="3"
        paintOrder="stroke fill"
      >
        OFF-ROAD BUGGY RACING
      </text>
    </svg>
  );
}

export function PowerUpIconSvg({
  type,
  className = 'w-7 h-7',
}: {
  type: PowerUpType | null;
  className?: string;
}) {
  if (!type) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <polygon
          points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5"
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="1.75"
          strokeDasharray="3 2"
        />
      </svg>
    );
  }

  switch (type) {
    case 'nitro':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M13 2L4 14h6l-1 8 11-13h-6l-1-7z"
            fill="#f97316"
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12.5 5.5L8 12h3.5l-.5 5.5L16.5 11H13z" fill="#fef08a" />
        </svg>
      );
    case 'shockwave':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="#eab308" strokeWidth="2" />
          <circle cx="12" cy="12" r="5" fill="#fde047" stroke="#0f172a" strokeWidth="1.4" />
          <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 2.5L4.5 6v6c0 5 3.2 8.7 7.5 10 4.3-1.3 7.5-5 7.5-10V6L12 2.5z"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <path
            d="M12 5.2L7 7.5V12c0 3.4 2.1 6.1 5 7.2 2.9-1.1 5-3.8 5-7.2V7.5L12 5.2z"
            fill="#bae6fd"
            opacity="0.55"
          />
        </svg>
      );
    case 'oil':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 3c2.5 4.2 6.5 8 6.5 12a6.5 6.5 0 1 1-13 0c0-4 4-7.8 6.5-12z"
            fill="#9333ea"
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#e9d5ff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'magnet':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5 12l5-7v4.5h9v5h-9V19l-5-7z"
            fill="#10b981"
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7.5 12l2.5-3.5v7L7.5 12z" fill="#a7f3d0" />
        </svg>
      );
  }
}
