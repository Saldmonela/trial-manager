import React from 'react';
import ServiceCard from './ServiceCard';
import { cn } from '../../utils';
import { Sparkles, Palette } from 'lucide-react';

export default function ServicesSection({
  services,
  theme,
  style = 'editorial',
  isAdmin = false,
  onToggleStyle,
  onRequest,
}) {
  if (!services || services.length === 0) return null;

  const isDark = theme === 'dark';

  return (
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className={cn( "w-5 h-5", isDark ? "text-yellow-500" : "text-yellow-600" )} />
        <h2 className={cn(
          "text-sm font-bold uppercase tracking-widest",
          isDark ? "text-stone-400" : "text-stone-500"
        )}>
          Premium Upgrades
        </h2>

        <div className={cn("h-px flex-1", isDark ? "bg-stone-800" : "bg-stone-200")} />
        
        {onToggleStyle && (
          <button 
            onClick={onToggleStyle}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDark ? "hover:bg-stone-800 text-stone-500" : "hover:bg-stone-100 text-stone-400"
            )}
            title="Switch Design Style"
          >
            <Palette size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            family={service}
            theme={theme}
            variant={style}
            isAdmin={isAdmin}
            onRequest={onRequest}
          />
        ))}
      </div>
    </div>
  );
}
