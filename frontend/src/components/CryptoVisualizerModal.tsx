import { useState, useEffect } from 'react';
import type { FileRecord } from '../types/api';
import { fetchFileMetadata } from '../api/files';
import { useAuthContext } from '../contexts/AuthContext';
import {
  ShieldIcon,
  ActivityIcon,
  CpuIcon,
  KeyIcon,
  FileIcon,
  LockIcon,
  CloseIcon,
  RefreshCwIcon
} from './icons';

interface CryptoVisualizerModalProps {
  visible: boolean;
  selectedFile: FileRecord | null;
  onClose: () => void;
}

export function CryptoVisualizerModal({ visible, selectedFile, onClose }: CryptoVisualizerModalProps) {
  const { token } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'inspector' | 'live-engine'>('inspector');
  const [loading, setLoading] = useState(false);

  // File breakdown state
  const [iv, setIv] = useState<string | null>(null);
  const [authTag, setAuthTag] = useState<string | null>(null);
  const [encryptedKey, setEncryptedKey] = useState<string | null>(null);
  const [isClientEncrypted, setIsClientEncrypted] = useState(true);

  // Live sandbox state
  const [sandboxText, setSandboxText] = useState('Top secret confidential document contents.');
  const [sandboxKeyB64, setSandboxKeyB64] = useState<string | null>(null);
  const [sandboxIv, setSandboxIv] = useState<string | null>(null);
  const [sandboxCiphertext, setSandboxCiphertext] = useState<string | null>(null);
  const [sandboxTag, setSandboxTag] = useState<string | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (selectedFile && token) {
      setLoading(true);
      fetchFileMetadata(token, selectedFile.id)
        .then((meta) => {
          setIv(meta.aesIv || null);
          setAuthTag(meta.aesAuthTag || null);
          setEncryptedKey(meta.encryptedAesKey || null);
          setIsClientEncrypted(Boolean(meta.isClientEncrypted));
        })
        .catch(() => {
          // fallback if offline
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, selectedFile, token]);

  async function runSandboxCrypto() {
    setSandboxRunning(true);
    try {
      const enc = new TextEncoder();
      const data = enc.encode(sandboxText);

      // 1. Generate 256-bit AES key in browser
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Export raw key
      const rawKey = await window.crypto.subtle.exportKey('raw', key);
      const binKey = String.fromCharCode(...new Uint8Array(rawKey));
      setSandboxKeyB64(btoa(binKey));

      // 2. 12-byte random IV
      const randomIv = window.crypto.getRandomValues(new Uint8Array(12));
      const binIv = String.fromCharCode(...randomIv);
      setSandboxIv(btoa(binIv));

      // 3. Encrypt with AES-GCM
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: randomIv, tagLength: 128 },
        key,
        data
      );

      const encArray = new Uint8Array(encrypted);
      const ciphertextPart = encArray.slice(0, encArray.length - 16);
      const tagPart = encArray.slice(encArray.length - 16);

      const binCipher = String.fromCharCode(...ciphertextPart);
      const binTag = String.fromCharCode(...tagPart);

      setSandboxCiphertext(btoa(binCipher));
      setSandboxTag(btoa(binTag));
    } finally {
      setSandboxRunning(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'live-engine' && !sandboxCiphertext) {
      runSandboxCrypto();
    }
  }, [activeTab]);

  if (!visible) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '960px', width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CpuIcon size={22} style={{ color: '#38bdf8' }} />
              <span>Cryptographic Security Inspector</span>
            </h3>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Visualizing the AES-256-GCM and RSA-OAEP encryption layers
            </p>
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

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'inspector' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'inspector' ? '#fff' : '#94a3b8',
              padding: '0.6rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <FileIcon size={16} />
            <span>File Parameters {selectedFile ? `(${selectedFile.filename})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live-engine')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'live-engine' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'live-engine' ? '#fff' : '#94a3b8',
              padding: '0.6rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ActivityIcon size={16} />
            <span>Interactive Live Crypto Sandbox</span>
          </button>
        </div>

        {activeTab === 'inspector' ? (
          <div>
            {loading ? (
              <p style={{ color: '#94a3b8' }}>Reading encryption parameters from vault...</p>
            ) : !selectedFile ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 1rem' }}>Select any file from your dashboard table and click <strong>"Inspect"</strong> to view its encryption details.</p>
                <button type="button" onClick={() => setActiveTab('live-engine')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ActivityIcon size={16} />
                  <span>Try Interactive Sandbox Instead</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Security Model Indicator */}
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldIcon size={20} style={{ color: '#38bdf8' }} />
                      <div>
                        <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '1rem' }}>
                          {isClientEncrypted ? 'Zero-Knowledge Client End-to-End Encryption' : 'Server-Assisted Envelope Protection'}
                        </span>
                        <p style={{ margin: '2px 0 0', fontSize: '0.825rem', color: '#cbd5e1' }}>
                          File: <strong>{selectedFile.filename}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB, {selectedFile.mimeType})
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '4px 10px', borderRadius: '6px', color: '#38bdf8' }}>
                      WebCrypto AES-256-GCM
                    </span>
                  </div>
                </div>

                {/* Step 1: Initialization Vector */}
                <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1.25rem' }}>
                  <div className="crypto-step-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <span className="step-num" style={{ background: '#2563eb', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>1</span>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>Initialization Vector (Random Nonce)</strong>
                      <span className="step-tag" style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>96-bit (12 Bytes)</span>
                    </div>
                  </div>
                  <p className="crypto-step-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>
                    A fresh, random 12-byte number generated for every upload. This ensures that even if you upload the exact same file twice, the encrypted outputs look completely different.
                  </p>
                  <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '0.65rem', borderRadius: '6px', color: '#38bdf8', fontSize: '0.8rem', overflowX: 'auto' }}>
                    {iv || 'Generating...'}
                  </code>
                </div>

                {/* Step 2: AEAD Authentication Tag */}
                <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1.25rem' }}>
                  <div className="crypto-step-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <span className="step-num" style={{ background: '#2563eb', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>2</span>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>Authentication Tag (Integrity Seal)</strong>
                      <span className="step-tag" style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>128-bit MAC</span>
                    </div>
                  </div>
                  <p className="crypto-step-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>
                    A mathematical cryptographic seal. If an attacker or storage provider attempts to alter even a single byte of the file, decryption automatically rejects it.
                  </p>
                  <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '0.65rem', borderRadius: '6px', color: '#38bdf8', fontSize: '0.8rem', overflowX: 'auto' }}>
                    {authTag || 'Generating...'}
                  </code>
                </div>

                {/* Step 3: Asymmetric Key Envelope */}
                <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1.25rem' }}>
                  <div className="crypto-step-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <span className="step-num" style={{ background: '#2563eb', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>3</span>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>Encrypted File Key Envelope</strong>
                      <span className="step-tag" style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>RSA-OAEP-2048</span>
                    </div>
                  </div>
                  <p className="crypto-step-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>
                    The AES-256 key that unlocks this file was encrypted with the recipient's RSA public key. Only the recipient holding their private key can decrypt it.
                  </p>
                  <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '0.65rem', borderRadius: '6px', color: '#38bdf8', fontSize: '0.8rem', wordBreak: 'break-all', maxHeight: '90px', overflowY: 'auto' }}>
                    {encryptedKey || 'Generating...'}
                  </code>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: Interactive Sandbox Engine */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
              Type any message below and see in real-time how WebCrypto transforms human-readable text into an uncrackable 256-bit ciphertext block directly inside your browser.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
                Test Message to Encrypt:
              </label>
              <textarea
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '8px', background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)', fontFamily: 'inherit' }}
              />
              <button
                type="button"
                onClick={runSandboxCrypto}
                disabled={sandboxRunning}
                style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCwIcon size={16} />
                <span>{sandboxRunning ? 'Encrypting in Browser...' : 'Encrypt Live with WebCrypto'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <KeyIcon size={16} style={{ color: '#38bdf8' }} />
                  <strong style={{ fontSize: '0.9rem' }}>Random 256-bit AES Key</strong>
                </div>
                <p className="crypto-step-desc" style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 6px' }}>Generated via window.crypto.subtle.generateKey</p>
                <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '6px', borderRadius: '4px', color: '#38bdf8', fontSize: '0.75rem', wordBreak: 'break-all' }}>{sandboxKeyB64 || '...'}</code>
              </div>

              <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ActivityIcon size={16} style={{ color: '#38bdf8' }} />
                  <strong style={{ fontSize: '0.9rem' }}>Random 12-byte Nonce (IV)</strong>
                </div>
                <p className="crypto-step-desc" style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 6px' }}>Generated via window.crypto.getRandomValues</p>
                <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '6px', borderRadius: '4px', color: '#38bdf8', fontSize: '0.75rem', wordBreak: 'break-all' }}>{sandboxIv || '...'}</code>
              </div>
            </div>

            <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <ShieldIcon size={16} style={{ color: '#4ade80' }} />
                <strong style={{ fontSize: '0.9rem' }}>Authentication Tag (MAC)</strong>
              </div>
              <p className="crypto-step-desc" style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 6px' }}>Calculated during AES-GCM encryption to guarantee tamper proofing</p>
              <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '6px', borderRadius: '4px', color: '#4ade80', fontSize: '0.75rem', wordBreak: 'break-all' }}>{sandboxTag || '...'}</code>
            </div>

            <div className="crypto-step-card" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <LockIcon size={16} style={{ color: '#fb923c' }} />
                <strong style={{ fontSize: '0.9rem' }}>Resulting Ciphertext</strong>
              </div>
              <p className="crypto-step-desc" style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 6px' }}>Mathematically unreadable without the symmetric key</p>
              <code className="crypto-code-block" style={{ display: 'block', background: '#0b1120', padding: '6px', borderRadius: '4px', color: '#fb923c', fontSize: '0.75rem', wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto' }}>
                {sandboxCiphertext || '...'}
              </code>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="button" onClick={onClose} className="secondary" style={{ padding: '0.5rem 1.25rem' }}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
