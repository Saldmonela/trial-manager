import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

/**
 * Ring/donut gauge reusable. Menampilkan arc terisi `pct` (0..100) dengan label di tengah.
 * @param {number} pct - persentase terisi (0..100)
 * @param {string} label - teks besar di tengah (mis. "11%" atau "∞")
 * @param {string} [sublabel] - teks kecil di bawah label (mis. "used")
 * @param {string} [color] - warna arc (hex)
 * @param {number} [size] - diameter px
 * @param {number} [stroke] - tebal cincin px
 * @param {boolean} [isDark]
 */
export default function RadialGauge({
  pct,
  label,
  sublabel,
  color = '#C6A87C',
  size = 150,
  stroke = 14,
  isDark = false,
}) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clamped / 100) * circumference;
  const track = isDark ? '#292524' /* stone-800 */ : '#F5F5F4' /* stone-100 */;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn('font-serif font-bold leading-none', isDark ? 'text-stone-50' : 'text-stone-900')}
          style={{ fontSize: Math.round(size * 0.24) }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            className={cn(
              'text-[10px] uppercase tracking-widest font-bold mt-1',
              isDark ? 'text-stone-500' : 'text-stone-400',
            )}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
