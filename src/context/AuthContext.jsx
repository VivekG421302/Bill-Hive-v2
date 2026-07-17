import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import { dbGet, dbSet, dbRemove } from '../db/indexedDB';
import { TOKEN_COOKIE, TOKEN_TTL_MS, randomSalt, hashPassword, generateToken } from '../utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [user, setUser] = useState(null); // { username, name, email }

  const bootstrap = useCallback(async () => {
    const account = await dbGet('account');
    setHasAccount(!!account);

    const cookieToken = Cookies.get(TOKEN_COOKIE);
    if (cookieToken && account) {
      const tokenRecord = await dbGet('authTokens', cookieToken);
      if (tokenRecord && tokenRecord.expiresAt > Date.now()) {
        setUser({ username: account.username, name: account.name, email: account.email });
      } else {
        // expired or unknown token — clean up
        Cookies.remove(TOKEN_COOKIE);
        if (tokenRecord) await dbRemove('authTokens', cookieToken);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const register = useCallback(async ({ username, password, name, email }) => {
    const existing = await dbGet('account');
    if (existing) throw new Error('An account already exists on this device.');
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const account = { username, passwordHash, salt, name: name || username, email: email || '' };
    await dbSet('account', account);
    return login({ username, password });
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const account = await dbGet('account');
    if (!account || account.username.toLowerCase() !== username.toLowerCase()) {
      throw new Error('Invalid username or password.');
    }
    const candidateHash = await hashPassword(password, account.salt);
    if (candidateHash !== account.passwordHash) {
      throw new Error('Invalid username or password.');
    }
    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    await dbSet('authTokens', { token, expiresAt }, token);
    Cookies.set(TOKEN_COOKIE, token, { expires: 7, sameSite: 'Lax' });
    setUser({ username: account.username, name: account.name, email: account.email });
    setHasAccount(true);
    return true;
  }, []);

  const logout = useCallback(async () => {
    const token = Cookies.get(TOKEN_COOKIE);
    if (token) await dbRemove('authTokens', token);
    Cookies.remove(TOKEN_COOKIE);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const account = await dbGet('account');
    if (!account) return;
    const updated = { ...account, ...patch };
    await dbSet('account', updated);
    setUser((u) => (u ? { ...u, name: updated.name, email: updated.email } : u));
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const account = await dbGet('account');
    if (!account) throw new Error('No account found.');
    const currentHash = await hashPassword(currentPassword, account.salt);
    if (currentHash !== account.passwordHash) throw new Error('Current password is incorrect.');
    const salt = randomSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    await dbSet('account', { ...account, salt, passwordHash });
  }, []);

  const tokenExpiryDate = useCallback(async () => {
    const token = Cookies.get(TOKEN_COOKIE);
    if (!token) return null;
    const record = await dbGet('authTokens', token);
    return record ? new Date(record.expiresAt) : null;
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, hasAccount, user, register, login, logout, updateProfile, changePassword, tokenExpiryDate }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
