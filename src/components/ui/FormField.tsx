import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';

interface FormFieldProps {
  label?: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'password';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  max?: string;
  /** Optional suffix element, e.g. show/hide password button */
  suffix?: React.ReactNode;
}

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  max,
  suffix,
}: FormFieldProps) {
  const { theme } = useTheme();

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
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          max={max}
          className={cn(
            "w-full px-4 py-4 border-b-2 bg-transparent focus:outline-none transition-colors",
            suffix && "pr-10",
            theme === 'light'
              ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900"
              : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
          )}
        />
        {suffix}
      </div>
    </div>
  );
}
