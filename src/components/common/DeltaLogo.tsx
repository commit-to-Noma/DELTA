import React from 'react';

interface DeltaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const DeltaLogo: React.FC<DeltaLogoProps> = ({
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-base', sub: 'text-[9px]' },
    md: { icon: 'w-8 h-8', text: 'text-xl', sub: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl', sub: 'text-xs' },
  };

  const { icon, text, sub } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative ${icon} flex-shrink-0 flex items-center justify-center`}>
        <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
          {/* Outer Delta Geometry */}
          <path d="M24 6L43 39H5L24 6Z" stroke="#FF5E1E" strokeWidth="2.5" strokeLinejoin="round" />
          {/* Contour Layer */}
          <path d="M24 16L36 37H12L24 16Z" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="2 2" />
          {/* Water Inflow Core */}
          <path d="M24 24L31 36H17L24 24Z" fill="#FF5E1E" fillOpacity="0.25" stroke="#FF5E1E" strokeWidth="1" />
          {/* Water level sensor bar */}
          <line x1="15" y1="31" x2="33" y2="31" stroke="#0284C7" strokeWidth="1.5" />
          {/* Coordinate apex */}
          <circle cx="24" cy="6" r="2.5" fill="#FF5E1E" />
        </svg>
      </div>

      {showLabel && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-2">
            <span className={`font-display font-bold ${text} tracking-wider text-storm-50 leading-none`}>
              DELTA
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-onyx-800 text-storm-400 border border-onyx-700 tracking-widest uppercase">
              V0.1.0-SPEC
            </span>
          </div>
          <span className={`font-mono ${sub} text-storm-400 tracking-widest uppercase mt-0.5`}>
            Terrain & Action Engine
          </span>
        </div>
      )}
    </div>
  );
};
