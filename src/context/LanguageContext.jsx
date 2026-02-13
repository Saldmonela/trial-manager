import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../constants/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Default to English, or load from localStorage
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('fm_language');
    return saved || 'en';
  });

  useEffect(() => {
    localStorage.setItem('fm_language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'id' : 'en');
  };

  // Translation function: nested key support (e.g. 'dashboard.title')
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key; // Fallback to key if missing
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
