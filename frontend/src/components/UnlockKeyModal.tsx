import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyIcon, LockIcon, AlertCircleIcon, CloseIcon } from './icons';

interface UnlockKeyModalProps {
  visible: boolean;
  onUnlock: (password: string) => Promise<void>;
  unlocking: boolean;
  error?: string | null;
  onClose?: () => void;
}

export function UnlockKeyModal({ visible, onUnlock, unlocking, error, onClose }: UnlockKeyModalProps) {
  const [password, setPassword] = useState('');

  if (!visible) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUnlock(password);
    setPassword('');
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit} style={{ maxWidth: '440px', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', padding: '10px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '10px', color: '#60a5fa' }}>
              <KeyIcon size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Unlock Your Vault Key</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Session security requirement</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              title="Dismiss"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '1.25rem' }}>
          To keep your documents completely private, your encryption key is locked with your password. Unlocking loads your key into your browser memory only, allowing you to decrypt and view your files.
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <AlertCircleIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
          Account Password
        </label>
        <input
          type="password"
          placeholder="Enter your account password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '1.25rem' }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          {onClose && (
            <button type="button" onClick={onClose} className="secondary" style={{ flex: 1 }}>
              Browse First
            </button>
          )}
          <button type="submit" disabled={unlocking} style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            {unlocking ? (
              <>Decrypting Key...</>
            ) : (
              <>
                <LockIcon size={16} />
                <span>Unlock Vault</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
