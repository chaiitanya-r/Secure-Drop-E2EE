import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { LoginForm } from './components/LoginForm';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { ShareModal } from './components/ShareModal';
import { UnlockKeyModal } from './components/UnlockKeyModal';
import { PublicShareView } from './components/PublicShareView';
import { AuditLogModal } from './components/AuditLogModal';
import { CryptoVisualizerModal } from './components/CryptoVisualizerModal';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { usePrivateKey } from './hooks/usePrivateKey';
import {
  downloadEncryptedFile,
  fetchFileMetadata,
  fetchFiles,
  shareFileRequest,
  fetchUserPublicKey
} from './api/files';
import type { FileRecord } from './types/api';
import { decryptFileAesKey, decryptFileContents, reEncryptAesKeyForRecipient } from './lib/crypto';
import { saveFile } from './lib/download';
import {
  ShieldIcon,
  LockIcon,
  UnlockIcon,
  CpuIcon,
  LogOutIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  InfoIcon
} from './components/icons';

function Dashboard() {
  const { token, user, logout } = useAuthContext();
  const { unlockedPrivateKey, unlock, lock, unlocking, unlockError, hasEncryptedKey } =
    usePrivateKey();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<FileRecord | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [inspectFile, setInspectFile] = useState<FileRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Prompt unlock on initial mount if key is encrypted but not yet unlocked
  useEffect(() => {
    if (hasEncryptedKey && !unlockedPrivateKey) {
      setShowUnlockModal(true);
    }
  }, [hasEncryptedKey, unlockedPrivateKey]);

  const loadFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchFiles(token);
      setFiles(data);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleDownload(file: FileRecord) {
    if (!token) return;
    if (!unlockedPrivateKey) {
      setStatus('Please unlock your vault key to decrypt this file.');
      setShowUnlockModal(true);
      return;
    }
    setDownloadingId(file.id);
    setStatus(null);
    try {
      const metadata = await fetchFileMetadata(token, file.id);
      const encryptedBuffer = await downloadEncryptedFile(token, file.id);
      const aesKey = await decryptFileAesKey(metadata.encryptedAesKey, unlockedPrivateKey);
      const plaintext = await decryptFileContents(
        encryptedBuffer,
        aesKey,
        metadata.aesIv,
        metadata.aesAuthTag
      );
      saveFile(plaintext, metadata.filename, metadata.mimeType);
      setStatus(`Successfully decrypted and downloaded "${metadata.filename}".`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleShare(email: string) {
    if (!token || !shareTarget) return;
    setStatus(null);
    try {
      if (unlockedPrivateKey) {
        setStatus(`Locally re-encrypting key for ${email} using WebCrypto...`);
        const recipient = await fetchUserPublicKey(token, email);
        const metadata = await fetchFileMetadata(token, shareTarget.id);
        const encryptedAesKeyForRecipient = await reEncryptAesKeyForRecipient(
          metadata.encryptedAesKey,
          unlockedPrivateKey,
          recipient.rsaPublicKey
        );
        await shareFileRequest(token, shareTarget.id, email, encryptedAesKeyForRecipient);
        setStatus(`Zero-Knowledge access granted to ${email}. Key encrypted in browser.`);
      } else {
        await shareFileRequest(token, shareTarget.id, email);
        setStatus(`Access granted to ${email}.`);
      }
    } catch (err) {
      setStatus(`Share failed: ${(err as Error).message}`);
      throw err;
    }
  }

  if (!token || !user) {
    return <p>Missing authentication token.</p>;
  }

  return (
    <div className="dashboard">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '12px', color: '#38bdf8' }}>
            <ShieldIcon size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>Secure Drop E2EE</h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Signed in as <strong style={{ color: '#e2e8f0' }}>{user.email}</strong> ({user.role})
            </p>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Key Lock/Unlock State Button */}
          {unlockedPrivateKey ? (
            <button
              onClick={lock}
              className="secondary"
              title="Lock private key in memory"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80', background: 'rgba(74, 222, 128, 0.08)' }}
            >
              <UnlockIcon size={16} />
              <span>Vault Unlocked</span>
            </button>
          ) : (
            <button
              onClick={() => setShowUnlockModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eab308', color: '#0f172a', fontWeight: 600 }}
              title="Click to unlock your key and decrypt files"
            >
              <LockIcon size={16} />
              <span>Unlock Vault Key</span>
            </button>
          )}

          <button
            onClick={() => { setInspectFile(null); setShowVisualizer(true); }}
            className="secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Inspect cryptographic algorithms and parameters"
          >
            <CpuIcon size={16} />
            <span>Security Inspector</span>
          </button>

          <button
            onClick={() => setShowAuditModal(true)}
            className="secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="View tamper-evident SHA-256 audit ledger"
          >
            <ShieldIcon size={16} />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={logout}
            className="secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Sign out of your account"
          >
            <LogOutIcon size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Beginner-friendly Onboarding Cards */}
      {showGuide && (
        <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1.25rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <InfoIcon size={16} />
              <span>How This Vault Works</span>
            </span>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '4px' }}>1. Local Device Encryption</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Files are locked with AES-256-GCM right in your browser before transfer. The server never sees your unencrypted files.
              </div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '4px' }}>2. Burn-on-Read Links</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Share files via secret one-time links. Keys live in URL fragments and vanish forever after 1 download.
              </div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '4px' }}>3. Tamper-Evident Ledger</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Every action is cryptographically signed and chained. Any unauthorized tampering in the database is detected instantly.
              </div>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.85rem 1.25rem', borderRadius: '10px', color: '#7dd3fc', marginTop: '1.25rem', fontSize: '0.9rem' }}>
          <CheckCircleIcon size={18} />
          <span>{status}</span>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <FileUpload onUploaded={loadFiles} />
      </div>

      <section className="card" style={{ marginTop: '1.25rem', padding: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Stored Documents</h3>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Your end-to-end encrypted files stored in MongoDB GridFS
            </p>
          </div>
          <button
            onClick={loadFiles}
            disabled={loading}
            className="secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCwIcon size={14} />
            <span>{loading ? 'Refreshing...' : 'Refresh List'}</span>
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading vault files...</p>
        ) : (
          <FileList
            files={files}
            onDownload={handleDownload}
            onShare={setShareTarget}
            onInspect={(file) => {
              setInspectFile(file);
              setShowVisualizer(true);
            }}
            downloadingId={downloadingId}
          />
        )}
      </section>

      <ShareModal
        visible={Boolean(shareTarget)}
        fileName={shareTarget?.filename || ''}
        fileId={shareTarget?.id}
        token={token}
        unlockedPrivateKey={unlockedPrivateKey}
        onClose={() => setShareTarget(null)}
        onShare={(email) => handleShare(email)}
      />

      <UnlockKeyModal
        visible={showUnlockModal}
        onUnlock={async (pwd) => {
          await unlock(pwd);
          setShowUnlockModal(false);
        }}
        unlocking={unlocking}
        error={unlockError}
        onClose={() => setShowUnlockModal(false)}
      />

      <AuditLogModal
        visible={showAuditModal}
        token={token}
        onClose={() => setShowAuditModal(false)}
      />

      <CryptoVisualizerModal
        visible={showVisualizer}
        selectedFile={inspectFile}
        onClose={() => {
          setShowVisualizer(false);
          setInspectFile(null);
        }}
      />
    </div>
  );
}

function LoginGate() {
  const { login, register } = useAuthContext();

  return (
    <div className="auth-wrapper" style={{ maxWidth: '520px', margin: '3rem auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', color: '#38bdf8', marginBottom: '1rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <ShieldIcon size={42} />
        </div>
        <h1 style={{ fontSize: '2.1rem', margin: '0 0 0.5rem', fontWeight: 700 }}>Secure Drop E2EE</h1>
        <p className="hint" style={{ fontSize: '0.95rem', margin: 0, color: '#94a3b8', lineHeight: '1.4' }}>
          End-to-End Encrypted File Sharing & Zero-Knowledge Document Vault
        </p>
      </div>

      <LoginForm
        onLogin={async (email, password) => login(email, password)}
        onRegister={async (email, password) => register(email, password)}
      />

      {/* Security Architecture Highlights for Reviewers / Beginners */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1.25rem', marginTop: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldIcon size={14} />
          <span>Core Security Guarantees:</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>
            <strong style={{ color: '#e2e8f0' }}>Browser-Side Encryption:</strong> Documents are encrypted with AES-256-GCM before transport. The server never sees plaintext.
          </li>
          <li>
            <strong style={{ color: '#e2e8f0' }}>Zero-Knowledge Key Wrapping:</strong> Encryption keys are protected using RSA-OAEP. Server has zero knowledge of file keys.
          </li>
          <li>
            <strong style={{ color: '#e2e8f0' }}>Self-Destructing Share Links:</strong> Ephemeral links burn on read; keys live strictly in client URL hash fragments (RFC 3986).
          </li>
          <li>
            <strong style={{ color: '#e2e8f0' }}>Tamper-Evident Audit Ledger:</strong> Every access event is chained with SHA-256 hashes to guarantee data integrity.
          </li>
        </ul>
      </div>
    </div>
  );
}

function App() {
  const { token } = useAuthContext();
  const [isShareRoute, setIsShareRoute] = useState(
    () => typeof window !== 'undefined' && window.location.hash.startsWith('#/share/')
  );

  useEffect(() => {
    const handleHashChange = () => {
      setIsShareRoute(window.location.hash.startsWith('#/share/'));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isShareRoute) {
    return (
      <main className="app">
        <PublicShareView />
      </main>
    );
  }

  return <main className="app">{token ? <Dashboard /> : <LoginGate />}</main>;
}

export default function AppWithProviders() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
