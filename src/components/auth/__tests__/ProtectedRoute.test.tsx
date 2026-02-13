import { describe, it, expect } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

function renderWithRouter(session: unknown, initialRoute = '/protected') {
  return rtlRender(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute session={session}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('renders children when session exists', () => {
    renderWithRouter({ user: { id: 'user-1' } });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when session is null', () => {
    renderWithRouter(null);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /login when session is undefined', () => {
    renderWithRouter(undefined);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
