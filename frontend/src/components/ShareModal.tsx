import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  createEphemeralLinkRequest,
  fetchFileMetadata
} from '../api/files';
import { exportRawAesKeyB64 } from '../lib/crypto';
import {
  UserIcon,
  LinkIcon,
  CopyIcon,
  CheckCircleIcon,
  CloseIcon,
  ShieldIcon,
  AlertCircleIcon
} from './icons';

interface ShareModalProps {
  visible: boolean;
  fileName: string;
  fileId?: string;
  token?: string | null;
  unlockedPrivateKey?: CryptoKey | null;
  onClose: () => void;
  onShare: (email: string) => Promise<void>;
}

export function ShareModal({
  visible,
  fileName,
  fileId,
  token,
  unlockedPrivateKey,
  onClose,
  onShare
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<'user' | 'ephemeral'>('user');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Ephemeral link states
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkGenerating, setLinkGenerating] = useState(false);

  if (!visible) return null;

  async function handleUserShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await onShare(email);
      setStatus(`Access granted to ${email}`);
      setEmail('');
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateEphemeralLink() {
    if (!token || !fileId) return;
    if (!unlockedPrivateKey) {
      setStatus('Please unlock your vault key in the dashboard to generate an encrypted link.');
      return;
    }

    setLinkGenerating(true);
    setStatus(null);
    setGeneratedLink(null);
    setCopied(false);

    try {
      // 1. Fetch file metadata
      const metadata = await fetchFileMetadata(token, fileId);

      // 2. Decrypt AES key with owner private key in browser memory
      const rawAesKeyB64 = await exportRawAesKeyB64(metadata.encryptedAesKey, unlockedPrivateKey);

      // 3. Create ephemeral token on backend (server gets zero key knowledge)
      const linkRecord = await createEphemeralLinkRequest(token, fileId, {
        expiresInHours,
        maxDownloads
      });

      // 4. Construct URL with key in the hash fragment (RFC 3986 fragment isolation)
      const fullUrl = `${window.location.origin}/#/share/${linkRecord.token}#key=${encodeURIComponent(rawAesKeyB64)}`;
      setGeneratedLink(fullUrl);
      setStatus('Encrypted share link created successfully.');
    } catch (err) {
      setStatus(`Failed to generate link: ${(err as Error).message}`);
    } finally {
      setLinkGenerating(false);
    }
  }

  function handleCopyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '520px', width: '92%', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Share File</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>{fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            title="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Tab selection */}
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', padding: '4px', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('user'); setStatus(null); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'user' ? '#fff' : '#94a3b8',
              padding: '0.6rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <UserIcon size={16} />
            <span>Vault User</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('ephemeral'); setStatus(null); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'ephemeral' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'ephemeral' ? '#fff' : '#94a3b8',
              padding: '0.6rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <LinkIcon size={16} />
            <span>One-Time Secret Link</span>
          </button>
        </div>

        {activeTab === 'user' ? (
          <form onSubmit={handleUserShare} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
              Grant encrypted access to another registered user. The file key is safely re-encrypted using their RSA public key directly on your device.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
                Recipient Email
              </label>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {status && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#86efac', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <CheckCircleIcon size={16} />
                <span>{status}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} className="secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShieldIcon size={16} />
                <span>{loading ? 'Granting Access...' : 'Grant E2EE Access'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
              Create a self-destructing link that anyone can open without needing an account. The decryption key is embedded in the link and never sent to any server.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
                  Link Expiration
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours (1 day)</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
                  Download Limit
                </label>
                <select
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                >
                  <option value={1}>1 download (Burn on Read)</option>
                  <option value={5}>5 downloads</option>
                  <option value={10}>10 downloads</option>
                  <option value={0}>Unlimited downloads</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateEphemeralLink}
              disabled={linkGenerating || !unlockedPrivateKey}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '0.75rem', width: '100%' }}
            >
              {linkGenerating ? (
                <span>Generating Secure Link...</span>
              ) : !unlockedPrivateKey ? (
                <>
                  <AlertCircleIcon size={18} />
                  <span>Unlock Vault Key to Create Link</span>
                </>
              ) : (
                <>
                  <LinkIcon size={18} />
                  <span>Generate Self-Destructing Link</span>
                </>
              )}
            </button>

            {generatedLink && (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '8px', fontWeight: 600 }}>
                  <CheckCircleIcon size={16} />
                  <span>One-Time Secret Link Ready:</span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem', padding: '8px', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', marginBottom: '10px' }}
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: copied ? '#16a34a' : '#2563eb' }}
                >
                  {copied ? (
                    <>
                      <CheckCircleIcon size={16} />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon size={16} />
                      <span>Copy Secret Link</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', gap: '8px' }}>
              <ShieldIcon size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Privacy Guarantee:</strong> The secret key is included after the hash tag (<code style={{ color: '#38bdf8' }}>#key=</code>). Standard web browsers never transmit this part to the server.
              </div>
            </div>

            {status && !generatedLink && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#86efac', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <CheckCircleIcon size={16} />
                <span>{status}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button type="button" onClick={onClose} className="secondary">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
