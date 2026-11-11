import React, { useId } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';
interface FormFieldProps {
  label?: string; id?: string; type?: 'text' | 'email' | 'password' | 'date' | 'number' | 'select';
  value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string; required?: boolean; disabled?: boolean; suffix?: React.ReactNode;
  options?: { value: string; label: string; disabled?: boolean }[]; className?: string;
  min?: string | number; max?: string | number; step?: string | number; maxLength?: number;
}
export default function FormField({ label, id, type='text', value, onChange, placeholder, required=false, disabled=false, min, max, step, maxLength, suffix, options, className }: FormFieldProps) {
  const generated = useId(); const fieldId = id || generated; const { theme } = useTheme();
  const classes = cn('w-full px-4 py-3 border bg-transparent focus:outline-none transition-colors',
    theme === 'light' ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900' : 'border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50', className);
  return <div>
    {label && <label htmlFor={fieldId} className={cn('block text-xs uppercase tracking-widest font-medium mb-2', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>{label}</label>}
    <div className={suffix ? 'relative' : undefined}>
      {type === 'select' ? <select id={fieldId} value={value} onChange={onChange} className={classes} required={required} disabled={disabled}>
        {options?.map(opt => <option key={opt.value} value={opt.value} disabled={opt.disabled} className="text-black">{opt.label}</option>)}
      </select> : <input id={fieldId} type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} min={min} max={max} step={step} maxLength={maxLength} className={classes} />}
      {suffix}
    </div>
  </div>;
}
