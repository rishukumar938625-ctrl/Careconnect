import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

export interface CustomWrapperProps {
  children: React.ReactNode;
  initialEntries?: MemoryRouterProps['initialEntries'];
}

export function createWrapper(initialEntries: MemoryRouterProps['initialEntries'] = ['/']) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </AuthProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: MemoryRouterProps['initialEntries'] }
) {
  const { initialEntries, ...renderOptions } = options || {};
  return render(ui, { wrapper: createWrapper(initialEntries), ...renderOptions });
}
