import React from 'react';
import type { AvatarConfig } from '../../shared/types.ts';

export const HERO_ISLAND_IMG = '/src/assets/images/quiztopia_welcome_hero_1794892477815.jpg';
export const WIZARD_MASCOT_IMG = '/src/assets/images/quiztopia_wizard_companion_1794892478764.jpg';
export const ISLAND_SCENE_IMG = '/src/assets/images/quiztopia_island_scene_1794892478675.jpg';
export const QUIZ_SKY_IMG = '/src/assets/images/quiztopia_quiz_sky_1794892479111.jpg';

export function TeamAvatarArt({
  avatar,
  size = 56,
  className = '',
}: {
  avatar: AvatarConfig;
  size?: number;
  className?: string;
}) {
  const primary = avatar?.primaryColor || '#6D28D9';
  const accent = avatar?.accentColor || '#F59E0B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 rounded-full overflow-hidden shadow-sm border-2 border-amber-300 bg-indigo-950 ${className}`}
      aria-label="Team Avatar"
    >
      <defs>
        <linearGradient id={`bg-${primary.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#311B6B" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#bg-${primary.slice(1)})`} />
      {/* Stars in backdrop */}
      <circle cx="18" cy="24" r="1.5" fill="#FDE68A" opacity="0.8" />
      <circle cx="82" cy="22" r="2" fill="#FDE68A" opacity="0.9" />
      <circle cx="84" cy="64" r="1.5" fill="#BAE6FD" opacity="0.7" />

      {/* Clothing / Shoulders */}
      {avatar.clothingStyle === 'cape' && (
        <path d="M18 96 Q50 66 82 96 Z" fill={accent} opacity="0.9" />
      )}
      <path d="M22 98 C24 72 76 72 78 98 Z" fill={primary} />
      <path d="M40 75 L50 88 L60 75 Z" fill={accent} />

      {/* Back Hair */}
      {avatar.hairStyle === 'braids' && (
        <>
          <rect x="26" y="45" width="9" height="28" rx="4" fill="#6B3E26" />
          <rect x="65" y="45" width="9" height="28" rx="4" fill="#6B3E26" />
        </>
      )}
      {avatar.hairStyle === 'curly' && (
        <>
          <circle cx="29" cy="48" r="10" fill="#5C3317" />
          <circle cx="71" cy="48" r="10" fill="#5C3317" />
        </>
      )}

      {/* Face */}
      <circle cx="50" cy="49" r="20" fill="#FCD5B5" />
      {/* Cheeks */}
      <circle cx="38" cy="54" r="3" fill="#FCA5A5" opacity="0.65" />
      <circle cx="62" cy="54" r="3" fill="#FCA5A5" opacity="0.65" />

      {/* Eyes */}
      <circle cx="42" cy="48" r="3.2" fill="#1E1B4B" />
      <circle cx="58" cy="48" r="3.2" fill="#1E1B4B" />
      <circle cx="43.2" cy="46.8" r="1.1" fill="#FFFFFF" />
      <circle cx="59.2" cy="46.8" r="1.1" fill="#FFFFFF" />

      {/* Face Expression */}
      {avatar.faceStyle === 'happy' && (
        <path d="M43 56 Q50 63 57 56" fill="none" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" />
      )}
      {avatar.faceStyle === 'curious' && (
        <circle cx="50" cy="58" r="2.6" fill="#7C2D12" />
      )}
      {avatar.faceStyle === 'determined' && (
        <>
          <path d="M38 42 L46 44" stroke="#5C3317" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M62 42 L54 44" stroke="#5C3317" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M44 57 Q50 61 56 57" fill="none" stroke="#7C2D12" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {avatar.faceStyle === 'sparkle' && (
        <>
          <path d="M43 56 Q50 62 57 56" fill="none" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M33 43 L35 40 L37 43 L35 46 Z" fill="#FBBF24" />
        </>
      )}

      {/* Top Hair */}
      <path d="M29 46 C29 28 71 28 71 46 C64 36 36 36 29 46 Z" fill="#6B3E26" />
      {avatar.hairStyle === 'spiky' && (
        <path d="M32 36 L39 24 L48 33 L55 22 L64 33 L70 28 L68 40 Z" fill="#6B3E26" />
      )}

      {/* Glasses accessory */}
      {avatar.accessory === 'glasses' && (
        <g stroke="#FBBF24" strokeWidth="2" fill="rgba(255,255,255,0.2)">
          <circle cx="42" cy="48" r="6" />
          <circle cx="58" cy="48" r="6" />
          <line x1="48" y1="48" x2="52" y2="48" />
        </g>
      )}

      {/* Wizard Hat */}
      {(avatar.accessory === 'wizard_hat' || avatar.characterType === 'wizard') &&
        avatar.accessory !== 'crown' && (
          <g>
            <ellipse cx="50" cy="31" rx="26" ry="6" fill={primary} stroke={accent} strokeWidth="2" />
            <path d="M35 30 L50 8 L65 30 Z" fill={primary} stroke={accent} strokeWidth="1.5" />
            <polygon points="50,16 52,20 56,20 53,22 54,26 50,24 46,26 47,22 44,20 48,20" fill={accent} />
          </g>
        )}

      {/* Crown */}
      {avatar.accessory === 'crown' && (
        <polygon
          points="34,31 38,16 45,24 50,14 55,24 62,16 66,31"
          fill={accent}
          stroke="#78350F"
          strokeWidth="1.5"
        />
      )}

      {/* Star Pin */}
      {avatar.accessory === 'star_pin' && (
        <polygon points="62,78 64,82 68,82 65,85 66,89 62,87 58,89 59,85 56,82 60,82" fill={accent} />
      )}
    </svg>
  );
}

export function CreatureIllustration({
  artKey,
  size = 96,
  className = '',
}: {
  artKey: string;
  size?: number;
  className?: string;
}) {
  const palettes: Record<string, { bg: string; main: string; sub: string; glow: string }> = {
    lumibun: { bg: '#EEF2FF', main: '#F8FAFC', sub: '#38BDF8', glow: '#FDE047' },
    sproutling: { bg: '#ECFDF5', main: '#4ADE80', sub: '#16A34A', glow: '#BBF7D0' },
    crystal_wisp: { bg: '#F5F3FF', main: '#A78BFA', sub: '#38BDF8', glow: '#E9D5FF' },
    emberling: { bg: '#FFF7ED', main: '#FB923C', sub: '#EF4444', glow: '#FDE047' },
    moonfox: { bg: '#EEF2FF', main: '#4338CA', sub: '#A5B4FC', glow: '#FACC15' },
    cloud_drake: { bg: '#EFF6FF', main: '#60A5FA', sub: '#E0F2FE', glow: '#BAE6FD' },
    star_unicorn: { bg: '#FDF4FF', main: '#F5F3FF', sub: '#C084FC', glow: '#FBBF24' },
    celestial_phoenix: { bg: '#FFFBEB', main: '#F97316', sub: '#FACC15', glow: '#FEF08A' },
    astral_dragon: { bg: '#F5F3FF', main: '#7C3AED', sub: '#EC4899', glow: '#FBBF24' },
  };

  const p = palettes[artKey] || palettes.crystal_wisp;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`shrink-0 ${className}`}
      aria-label={artKey}
    >
      <circle cx="60" cy="60" r="54" fill={p.bg} />
      <circle cx="60" cy="60" r="44" fill={p.glow} opacity="0.35" />

      {/* Wings for winged creatures */}
      {(artKey === 'cloud_drake' || artKey === 'celestial_phoenix' || artKey === 'astral_dragon' || artKey === 'emberling') && (
        <g>
          <path d="M36 62 C14 42 16 26 36 38 Z" fill={p.sub} stroke="#311B6B" strokeWidth="2" />
          <path d="M84 62 C106 42 104 26 84 38 Z" fill={p.sub} stroke="#311B6B" strokeWidth="2" />
        </g>
      )}

      {/* Ears / Horns */}
      {(artKey === 'lumibun' || artKey === 'moonfox') && (
        <g>
          <ellipse cx="42" cy="28" rx="8" ry="20" transform="rotate(-12 42 28)" fill={p.main} stroke="#311B6B" strokeWidth="2.5" />
          <ellipse cx="78" cy="28" rx="8" ry="20" transform="rotate(12 78 28)" fill={p.main} stroke="#311B6B" strokeWidth="2.5" />
          <ellipse cx="42" cy="29" rx="4" ry="12" transform="rotate(-12 42 29)" fill={p.sub} />
          <ellipse cx="78" cy="29" rx="4" ry="12" transform="rotate(12 78 29)" fill={p.sub} />
        </g>
      )}

      {artKey === 'star_unicorn' && (
        <g>
          <polygon points="60,10 54,36 66,36" fill={p.glow} stroke="#78350F" strokeWidth="2" />
          <ellipse cx="42" cy="36" rx="7" ry="11" fill={p.sub} stroke="#311B6B" strokeWidth="2" />
          <ellipse cx="78" cy="36" rx="7" ry="11" fill={p.sub} stroke="#311B6B" strokeWidth="2" />
        </g>
      )}

      {artKey === 'sproutling' && (
        <g>
          <path d="M60 32 C50 14 34 20 46 34 Z" fill={p.sub} stroke="#14532D" strokeWidth="2" />
          <path d="M60 32 C70 14 86 20 74 34 Z" fill={p.main} stroke="#14532D" strokeWidth="2" />
        </g>
      )}

      {(artKey === 'astral_dragon' || artKey === 'emberling' || artKey === 'cloud_drake') && (
        <g>
          <polygon points="44,34 38,16 52,28" fill={p.glow} stroke="#311B6B" strokeWidth="2" />
          <polygon points="76,34 82,16 68,28" fill={p.glow} stroke="#311B6B" strokeWidth="2" />
        </g>
      )}

      {/* Body */}
      <ellipse cx="60" cy="80" rx="22" ry="18" fill={p.main} stroke="#311B6B" strokeWidth="2.5" />
      <ellipse cx="60" cy="82" rx="13" ry="11" fill={p.sub} opacity="0.45" />

      {/* Head */}
      <circle cx="60" cy="54" r="22" fill={p.main} stroke="#311B6B" strokeWidth="2.5" />

      {/* Crystal Crest for wisp/dragon */}
      {(artKey === 'crystal_wisp' || artKey === 'astral_dragon') && (
        <polygon points="60,22 54,35 60,40 66,35" fill={p.sub} stroke="#311B6B" strokeWidth="1.8" />
      )}

      {/* Eyes */}
      <circle cx="51" cy="53" r="4" fill="#1E1B4B" />
      <circle cx="69" cy="53" r="4" fill="#1E1B4B" />
      <circle cx="52.5" cy="51.5" r="1.5" fill="#FFFFFF" />
      <circle cx="70.5" cy="51.5" r="1.5" fill="#FFFFFF" />

      {/* Cheeks & Smile */}
      <circle cx="44" cy="59" r="3" fill="#FDA4AF" opacity="0.8" />
      <circle cx="76" cy="59" r="3" fill="#FDA4AF" opacity="0.8" />
      <path d="M55 61 Q60 66 65 61" fill="none" stroke="#1E1B4B" strokeWidth="2.2" strokeLinecap="round" />

      {/* Sparkle stars */}
      <polygon points="24,28 26,32 30,32 27,35 28,39 24,37 20,39 21,35 18,32 22,32" fill="#FBBF24" />
      <polygon points="94,76 95,79 98,79 96,81 97,84 94,82 91,84 92,81 90,79 93,79" fill="#FBBF24" />
    </svg>
  );
}

export function BuildingIllustration({
  artKey,
  size = 84,
  className = '',
}: {
  artKey: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`shrink-0 ${className}`} aria-label={artKey}>
      <circle cx="50" cy="50" r="46" fill="#EEF2FF" />
      {artKey === 'central_castle' && (
        <g stroke="#311B6B" strokeWidth="2">
          <rect x="26" y="45" width="48" height="36" rx="4" fill="#E0E7FF" />
          <rect x="20" y="36" width="14" height="45" rx="2" fill="#C7D2FE" />
          <rect x="66" y="36" width="14" height="45" rx="2" fill="#C7D2FE" />
          <polygon points="18,36 27,18 36,36" fill="#7C3AED" />
          <polygon points="64,36 73,18 82,36" fill="#7C3AED" />
          <polygon points="38,45 50,16 62,45" fill="#6D28D9" />
          <path d="M43 81 V62 A7 7 0 0 1 57 62 V81 Z" fill="#F59E0B" />
        </g>
      )}
      {artKey === 'crystal_tower' && (
        <g stroke="#311B6B" strokeWidth="2">
          <rect x="38" y="42" width="24" height="40" rx="3" fill="#DDD6FE" />
          <polygon points="50,12 36,42 64,42" fill="#38BDF8" />
          <circle cx="50" cy="58" r="6" fill="#FBBF24" />
        </g>
      )}
      {artKey === 'wisdom_library' && (
        <g stroke="#311B6B" strokeWidth="2">
          <rect x="24" y="46" width="52" height="34" rx="4" fill="#FEF3C7" />
          <path d="M24 46 A26 22 0 0 1 76 46 Z" fill="#7C3AED" />
          <rect x="42" y="58" width="16" height="22" rx="2" fill="#F59E0B" />
        </g>
      )}
      {artKey === 'airship_dock' && (
        <g stroke="#311B6B" strokeWidth="2">
          <rect x="22" y="66" width="56" height="10" rx="3" fill="#B45309" />
          <ellipse cx="50" cy="36" rx="24" ry="13" fill="#60A5FA" />
          <rect x="40" y="49" width="20" height="8" rx="2" fill="#F59E0B" />
        </g>
      )}
      {artKey === 'emerald_grove' && (
        <g stroke="#14532D" strokeWidth="2">
          <rect x="45" y="62" width="10" height="20" fill="#92400E" />
          <circle cx="50" cy="48" r="20" fill="#22C55E" />
          <circle cx="36" cy="54" r="13" fill="#4ADE80" />
          <circle cx="64" cy="54" r="13" fill="#16A34A" />
        </g>
      )}
      {artKey === 'star_fountain' && (
        <g stroke="#1E3A8A" strokeWidth="2">
          <ellipse cx="50" cy="72" rx="28" ry="10" fill="#38BDF8" />
          <rect x="44" y="44" width="12" height="28" fill="#E0E7FF" />
          <path d="M50 38 Q30 48 32 68" fill="none" stroke="#7DD3FC" strokeWidth="4" />
          <path d="M50 38 Q70 48 68 68" fill="none" stroke="#7DD3FC" strokeWidth="4" />
        </g>
      )}
      {artKey === 'lantern_arch' && (
        <g stroke="#78350F" strokeWidth="2">
          <path d="M26 80 V42 A24 24 0 0 1 74 42 V80" fill="none" stroke="#92400E" strokeWidth="6" />
          <circle cx="50" cy="24" r="7" fill="#FBBF24" />
          <circle cx="32" cy="38" r="5" fill="#FDE047" />
          <circle cx="68" cy="38" r="5" fill="#FDE047" />
        </g>
      )}
      {artKey === 'rainbow_bridge' && (
        <g>
          <path d="M18 72 A32 32 0 0 1 82 72" fill="none" stroke="#EC4899" strokeWidth="5" />
          <path d="M23 72 A27 27 0 0 1 77 72" fill="none" stroke="#FACC15" strokeWidth="5" />
          <path d="M28 72 A22 22 0 0 1 72 72" fill="none" stroke="#38BDF8" strokeWidth="5" />
        </g>
      )}
    </svg>
  );
}
