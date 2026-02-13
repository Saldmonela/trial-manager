import React from 'react';
import { cn } from '../../utils';

export default function PublicMetricsRow({ totalFamilies, totalAvailableSlots }) {
  const metrics = [
    {
      label: 'Total Families',
      value: totalFamilies,
      valueClassName: 'text-stone-900',
    },
    {
      label: 'Available Slots',
      value: totalAvailableSlots,
      valueClassName: 'text-emerald-600',
    },
  ];

  return (
    <div id="tour-stats" className="grid grid-cols-2 gap-0 border-t border-l border-stone-200 mb-12 select-none md:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="p-6 border-b border-r border-stone-200 flex flex-col justify-between aspect-[4/3] group transition-all duration-500 relative overflow-hidden hover:bg-stone-50"
        >
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400">{metric.label}</span>

            <div className="flex flex-col gap-1">
              <span className={cn('font-serif text-3xl lg:text-5xl font-bold tracking-tighter break-all transition-colors', metric.valueClassName)}>
                {metric.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
