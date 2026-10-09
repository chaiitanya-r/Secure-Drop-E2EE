import { useState } from 'react';
import type { FormEvent } from 'react';
import { LockIcon, ShieldIcon, AlertCircleIcon } from './icons';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string) => Promise<unknown>;
}

export function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        await onRegister(email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: '2rem' }}>
      {/* Mode Selector Tabs */}
      <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          type="button"
          onClick={() => { setIsRegister(false); setError(null); }}
          style={{
            flex: 1,
            background: !isRegister ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
            color: !isRegister ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: !isRegister ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setIsRegister(true); setError(null); }}
          style={{
            flex: 1,
            background: isRegister ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
            color: isRegister ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isRegister ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
          }}
        >
          Create Account
        </button>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.35rem' }}>
          {isRegister ? 'Create Your Secure Drop Account' : 'Welcome Back'}
        </h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
          {isRegister
            ? 'Your browser will generate your unique encryption keypair automatically.'
            : 'Enter your credentials to access your end-to-end encrypted files.'}
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          <AlertCircleIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
            Email Address
          </label>
          <input
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0' }}>
              Password
            </label>
            {isRegister && (
              <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                Min. 12 characters
              </span>
            )}
          </div>
          <input
            type="password"
            placeholder={isRegister ? 'At least 12 characters (e.g. Pass123!@#456)' : 'Enter your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={12}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '0.75rem' }}
        >
          {loading ? (
            <span>{isRegister ? 'Generating Keys & Creating Account...' : 'Authenticating...'}</span>
          ) : (
            <>
              {isRegister ? <ShieldIcon size={18} /> : <LockIcon size={18} />}
              <span>{isRegister ? 'Create Secure Drop Account' : 'Sign In to Secure Drop'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
