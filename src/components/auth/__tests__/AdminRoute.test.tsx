import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminRoute from '../AdminRoute';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock ThemeContext
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

function renderWithRouter(initialRoute = '/admin') {
  return rtlRender(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>Admin Content</div>
            </AdminRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when user is admin', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      isAdmin: true,
      isLoading: false,
    });

    renderWithRouter();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when user is authenticated but not admin', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-2' } },
      isAdmin: false,
      isLoading: false,
    });

    renderWithRouter();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('redirects to /login when no session exists', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isAdmin: false,
      isLoading: false,
    });

    renderWithRouter();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isAdmin: false,
      isLoading: true,
    });

    renderWithRouter();
    expect(screen.getByText('Verifying access...')).toBeInTheDocument();
  });
});
