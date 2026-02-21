import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';

interface FormFieldProps {
  label?: string;
  type?: 'text' | 'email' | 'password' | 'date' | 'number' | 'select'; // Add select to type union
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  required?: boolean;
  suffix?: React.ReactNode;
  options?: { value: string; label: string }[];
  className?: string;
  max?: string | number; // Add max to props
}

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  max,
  suffix,
  options,
  className,
}: FormFieldProps) {
  const { theme } = useTheme();

  // Create a handler that works for both input and select
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // We cast to any here because the parent component expects a specific event type 
    // but we're making this component more generic. In a standardized system we'd fix the parent types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange(e as any);
  };

  return (
    <div className={suffix ? "relative" : undefined}>
      {label && (
        <label className={cn(
          "block text-xs uppercase tracking-widest font-medium mb-2",
          theme === 'light' ? "text-stone-500" : "text-stone-400"
        )}>
          {label}
        </label>
      )}
      <div className={suffix ? "relative" : undefined}>
        {type === 'select' ? (
          <select
            value={value}
            onChange={handleChange}
            className={cn(
              "w-full px-4 py-3 border bg-transparent focus:outline-none transition-colors appearance-none",
              theme === 'light'
                ? "border-stone-200 text-stone-900 focus:border-stone-900"
                : "border-stone-700 text-stone-50 focus:border-stone-50",
              className
            )}
            required={required}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value} className="text-black">
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            max={max}
            className={cn(
              "w-full px-4 py-3 border bg-transparent focus:outline-none transition-colors",
              theme === 'light'
                ? "border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900"
                : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50",
              className
            )}
          />
        )}
        {suffix}
      </div>
    </div>
  );
}
