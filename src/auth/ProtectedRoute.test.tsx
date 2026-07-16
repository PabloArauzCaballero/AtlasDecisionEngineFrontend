import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthStatus } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

function renderRoute(status: AuthStatus) {
  return render(
    <AuthContext.Provider
      value={{
        status,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshAccessToken: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/artifacts']}>
        <Routes>
          <Route path="/login" element={<h1>Inicia sesión</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/artifacts" element={<h1>Artefactos</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated user directly to login', () => {
    renderRoute('unauthenticated');
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Artefactos' })).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    renderRoute('authenticated');
    expect(screen.getByRole('heading', { name: 'Artefactos' })).toBeInTheDocument();
  });
});
