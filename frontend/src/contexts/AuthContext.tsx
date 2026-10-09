import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, registerRequest, fetchCurrentUser } from '../api/auth';
import type { AuthenticatedUser, LoginResponse } from '../types/api';

interface EncryptedPrivateKeyPayload {
  encryptedPrivateKey: string;
  privateKeyIv: string;
  privateKeySalt: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthenticatedUser | null;
  encryptedPrivateKey?: EncryptedPrivateKeyPayload | null;
  unlockedPrivateKey: CryptoKey | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  setUnlockedPrivateKey: (key: CryptoKey | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'sfs_auth_session';

function loadStoredSession():
  | { token: string; user: AuthenticatedUser; encrypted: EncryptedPrivateKeyPayload }
  | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = loadStoredSession();
  const [token, setToken] = useState<string | null>(stored?.token || null);
  const [user, setUser] = useState<AuthenticatedUser | null>(stored?.user || null);
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<EncryptedPrivateKeyPayload | null>(
    stored?.encrypted || null
  );
  const [unlockedPrivateKey, setUnlockedPrivateKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (token && user && !user.rsaPublicKey) {
      fetchCurrentUser(token)
        .then((profile) => {
          setUser((prev) => (prev ? { ...prev, rsaPublicKey: profile.rsaPublicKey } : null));
        })
        .catch(() => {});
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user && encryptedPrivateKey) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, user, encrypted: encryptedPrivateKey })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user, encryptedPrivateKey]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setToken(response.token);
    setUser(response.user);
    setEncryptedPrivateKey({
      encryptedPrivateKey: response.user.encryptedPrivateKey,
      privateKeyIv: response.user.privateKeyIv,
      privateKeySalt: response.user.privateKeySalt
    });
    setUnlockedPrivateKey(null);
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    // Register endpoint returns the same structure as login after registration
    const response = await registerRequest(email, password);
    setToken(response.token);
    setUser(response.user);
    setEncryptedPrivateKey({
      encryptedPrivateKey: response.user.encryptedPrivateKey,
      privateKeyIv: response.user.privateKeyIv,
      privateKeySalt: response.user.privateKeySalt
    });
    setUnlockedPrivateKey(null);
    return response;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setEncryptedPrivateKey(null);
    setUnlockedPrivateKey(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      encryptedPrivateKey,
      unlockedPrivateKey,
      login,
      register,
      logout,
      setUnlockedPrivateKey
    }),
    [token, user, encryptedPrivateKey, unlockedPrivateKey, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}


