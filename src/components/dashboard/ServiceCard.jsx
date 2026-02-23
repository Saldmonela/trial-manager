import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, ArrowRight, Star, Sparkles, Pencil } from 'lucide-react';
import { cn } from '../../utils';
import { formatCurrency } from '../../utils';

export default function ServiceCard({
  family,
  theme,
  variant = 'editorial', // 'editorial' | 'modern'
  isAdmin = false,
  onRequest,
}) {
  const isDark = theme === 'dark';

  // --- MODERN VARIANT (Previous Design) ---
  if (variant === 'modern') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        layout
        className={cn(
          "relative overflow-hidden rounded-2xl p-[2px] transition-all duration-300 group",
          isDark ? "shadow-lg" : "shadow-lg hover:shadow-xl"
        )}
      >
        {/* Static Border Fallback */}
        <div className={cn(
          "absolute inset-0 z-0 transition-colors duration-300",
          isDark ? "bg-stone-800" : "bg-stone-200"
        )} />
        
        {/* Animated Glowing Border */}
        <div className="absolute top-1/2 left-1/2 w-[200%] h-[300%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(transparent_0deg,transparent_200deg,#eab308_360deg)] animate-[spin_4s_linear_infinite] opacity-40 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />

        {/* Inner Content Card */}
        <div className={cn(
          "relative z-10 w-full h-full rounded-[14px] overflow-hidden flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center justify-between p-6 md:p-8",
          isDark 
            ? "bg-gradient-to-br from-stone-900 to-stone-950" 
            : "bg-white"
        )}>
          {/* Background Decor */}
          <div className="absolute top-0 right-0 p-32 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          {/* Left Side: Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
               <div className={cn(
                 "p-2 rounded-lg",
                 isDark ? "bg-yellow-500/10 text-yellow-500" : "bg-yellow-100 text-yellow-700"
               )}>
                  <Crown size={24} strokeWidth={1.5} />
               </div>
               <span className={cn(
                 "text-xs font-bold uppercase tracking-widest",
                 isDark ? "text-yellow-500" : "text-yellow-700"
               )}>
                 Premium Upgrade
               </span>
            </div>
  
            <div>
              <h3 className={cn(
                "text-2xl md:text-3xl font-serif font-bold mb-2",
                isDark ? "text-stone-50" : "text-stone-900"
              )}>
                {family.notes || family.name}
              </h3>
              <p className={cn(
                "text-sm md:text-base max-w-lg leading-relaxed",
                isDark ? "text-stone-400" : "text-stone-600"
              )}>
                {family.description || "Upgrade your personal account to premium status. Enjoy all benefits without joining a family group."}
              </p>
            </div>
  
            <div className="flex flex-wrap gap-4 mt-4">
               {(family.features || ['Private Account', 'Full Warranty', 'Instant Activation']).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                     <div className={cn(
                       "w-1.5 h-1.5 rounded-full",
                       isDark ? "bg-stone-600" : "bg-stone-300"
                     )} />
                     <span className={cn(
                       "text-xs font-medium uppercase tracking-wider",
                       isDark ? "text-stone-300" : "text-stone-700"
                     )}>
                       {feature}
                     </span>
                  </div>
               ))}
            </div>
          </div>
  
          {/* Right Side: Price & Action */}
          <div className="w-full md:w-auto flex flex-col items-start md:items-end gap-6 border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800 pt-6 md:pt-0 md:pl-8">
              <div className="text-left md:text-right">
                  <p className={cn(
                      "text-xs uppercase tracking-widest font-bold mb-1",
                      isDark ? "text-stone-500" : "text-stone-400"
                  )}>
                      {family.paymentType || "One-Time Payment"}
                  </p>
                  <div className="flex items-baseline gap-1 md:justify-end">
                      <span className={cn(
                          "text-sm font-medium -translate-y-4",
                          isDark ? "text-stone-400" : "text-stone-500"
                      )}>Rp</span>
                      <span className={cn(
                          "text-4xl md:text-5xl font-serif font-bold",
                          isDark ? "text-stone-50" : "text-stone-900"
                      )}>
                          {formatCurrency(family.priceSale || 0).replace('Rp', '')}
                      </span>
                  </div>
                  <p className={cn(
                      "text-xs mt-2",
                       isDark ? "text-stone-500" : "text-stone-400"
                  )}>
                      {family.validity || "Lifetime validity • No recurring fees"}
                  </p>
              </div>
  
              <button
                  onClick={() => onRequest(family)}
                  className={cn(
                      "group relative w-full md:w-auto px-8 py-4 overflow-hidden rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300",
                      isDark 
                          ? "bg-stone-50 text-stone-950 hover:bg-yellow-400" 
                          : "bg-stone-900 text-stone-50 hover:bg-stone-800"
                  )}
              >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                      {isAdmin ? 'Edit Configuration' : 'Upgrade Now'}
                      {isAdmin 
                         ? <Pencil size={16} className="group-hover:translate-x-1 transition-transform" />
                         : <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      }
                  </span>
              </button>
          </div>


        </div>
      </motion.div>
    );
  }

  // --- EDITORIAL VARIANT (Current Design) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className={cn(
        "relative overflow-hidden transition-all duration-300 group p-[2px]",
        isDark 
          ? "shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(234,179,8,0.4)]" 
          : "shadow-[4px_4px_0px_0px_rgba(28,25,23,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(234,179,8,1)]"
      )}
    >
      {/* Static Border Fallback */}
      <div className={cn(
        "absolute inset-0 z-0 transition-colors duration-300",
        isDark ? "bg-stone-800 group-hover:bg-yellow-500" : "bg-stone-200 group-hover:bg-yellow-500"
      )} />

      {/* Animated Glowing Border */}
      <div className="absolute top-1/2 left-1/2 w-[200%] h-[300%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(transparent_0deg,transparent_200deg,#eab308_360deg)] animate-[spin_4s_linear_infinite] opacity-40 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />

      {/* Inner Content Card */}
      <div className={cn(
        "relative z-10 w-full h-full flex flex-col md:flex-row",
        isDark 
          ? "bg-stone-900" 
          : "bg-white"
      )}>
      {/* Decorative Label */}
      <div className={cn(
        "absolute top-0 right-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest z-10",
        isDark ? "bg-yellow-500 text-stone-950" : "bg-stone-900 text-yellow-500"
      )}>
        Premium Upgrade
      </div>

      {/* Left Block: Icon & Identity */}
      <div className={cn(
        "p-6 md:p-8 flex-1 flex flex-col md:flex-row gap-6 items-center border-b md:border-b-0 md:border-r border-dashed",
        isDark ? "border-stone-800" : "border-stone-200"
      )}>
        {/* CENTERED ICON: items-center in parent md:flex-row */}
        <div className={cn(
           "w-20 h-20 flex items-center justify-center border-2 shrink-0",
           isDark ? "border-stone-700 bg-stone-800 text-yellow-500" : "border-stone-200 bg-stone-50 text-yellow-600"
        )}>
           <Crown strokeWidth={1.5} className="w-10 h-10" />
        </div>

        <div className="space-y-3 text-center md:text-left">
           <h3 className={cn(
             "text-2xl font-serif font-bold",
             isDark ? "text-stone-50" : "text-stone-900"
           )}>
             {family.notes || family.name}
           </h3>
           <p className={cn(
             "text-sm leading-relaxed max-w-md font-serif italic",
             isDark ? "text-stone-400" : "text-stone-500"
           )}>
             "{family.description || "Upgrade your personal account to premium status. Enjoy all benefits without joining a family group."}"
           </p>
           
           <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 pt-2">
              {(family.features || ['Private Account', 'Full Warranty', 'Instant Activation']).map((feature, i) => (
                 <div key={i} className="flex items-center gap-2">
                    <Check className={cn("w-3 h-3", isDark ? "text-yellow-500" : "text-stone-900")} />
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      isDark ? "text-stone-400" : "text-stone-600"
                    )}>
                      {feature}
                    </span>
                 </div>
              ))}
           </div>
        </div>
      </div>

      {/* Right Block: Price & CTA */}
      <div className={cn(
         "p-6 md:p-8 w-full md:w-auto flex flex-col items-center md:items-end justify-between gap-6",
         isDark ? "bg-stone-900/50" : "bg-stone-50/50"
      )}>
         <div className="text-center md:text-right space-y-1">
             <p className={cn("text-[10px] uppercase tracking-widest font-bold", isDark ? "text-stone-500" : "text-stone-400")}>{family.paymentType || "One-Time Payment"}</p>
             <div className="flex items-baseline gap-1 justify-center md:justify-end">
                <span className={cn("text-sm font-serif", isDark ? "text-stone-400" : "text-stone-500")}>Rp</span>
                <span className={cn("text-4xl font-serif font-bold", isDark ? "text-white" : "text-stone-900")}>
                    {formatCurrency(family.priceSale || 0).replace('Rp', '')}
                </span>
             </div>
             <p className={cn("text-[10px] font-mono", isDark ? "text-stone-600" : "text-stone-400")}>{family.validity || "Lifetime Validity"}</p>
         </div>

         <button
            onClick={() => onRequest(family)}
            className={cn(
                "group relative w-full md:w-auto px-8 py-3 overflow-hidden text-sm font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5",
                isDark 
                    ? "bg-stone-50 text-stone-950" 
                    : "bg-stone-900 text-stone-50"
            )}
        >
            <span className="relative z-10 flex items-center justify-center gap-3">
                {isAdmin ? 'Edit Configuration' : 'Upgrade Now'}
                {isAdmin 
                    ? <Pencil size={14} className="group-hover:translate-x-1 transition-transform" />
                    : <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                }
            </span>
        </button>
      </div>

      </div>
    </motion.div>
  );
}
