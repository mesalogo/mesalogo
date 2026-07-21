import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthActions } from './AuthContext';
import { authAPI } from '../services/api/auth';

jest.mock('../services/api/auth', () => ({
  authAPI: {
    login: jest.fn(),
  },
}));

jest.mock('../services/api/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

type LoginAction = (username: string, password: string) => Promise<any>;

const LoginActionProbe = ({ onReady }: { onReady: (login: LoginAction) => void }) => {
  const { login } = useAuthActions();

  useEffect(() => {
    onReady(login);
  }, [login, onReady]);

  return null;
};

test('preserves credential error metadata for localized login feedback', async () => {
  localStorage.clear();
  (authAPI.login as jest.Mock).mockResolvedValue({
    success: false,
    errorType: 'credentials',
    message: 'credentials',
  });

  let loginAction: LoginAction | undefined;
  const onReady = (login: LoginAction) => {
    loginAction = login;
  };

  render(
    <AuthProvider>
      <LoginActionProbe onReady={onReady} />
    </AuthProvider>
  );

  await waitFor(() => expect(loginAction).toBeDefined());

  let result;
  await act(async () => {
    result = await loginAction?.('admin', 'wrong-password');
  });

  expect(result).toEqual({
    success: false,
    errorType: 'credentials',
    message: 'credentials',
  });
});
