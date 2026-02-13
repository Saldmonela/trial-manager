import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';

/**
 * All-in-one wrapper that provides the context providers
 * needed by most components (theme, language, router).
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * Custom render that wraps the component in all required providers.
 * Use this instead of `@testing-library/react`'s `render` in tests.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library so tests only need one import
export * from '@testing-library/react';
export { customRender as render };
