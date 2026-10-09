import { useEffect, useState } from 'react';
import { fetchPublicLinkMetadata, downloadPublicEncryptedFile, type PublicLinkMetadata } from '../api/files';
import { importRawAesKey, decryptFileContents } from '../lib/crypto';
import { saveFile } from '../lib/download';
import {
  LockIcon,
  FileIcon,
  DownloadIcon,
  ClockIcon,
  FlameIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from './icons';

export function PublicShareView() {
  const [metadata, setMetadata] = useState<PublicLinkMetadata | null>(null);
  const [rawKeyB64, setRawKeyB64] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Parse URL hash for token and key:
    // Format: #/share/<token>#key=<key> OR #/share/<token>?key=<key>
    const fullHash = window.location.hash; // e.g. #/share/12345#key=xyz
    const pathPart = fullHash.split('#')[1] || ''; // /share/12345
    const keyPart = fullHash.split('#key=')[1] || ''; // xyz

    const match = pathPart.match(/\/share\/([a-f0-9]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      setError('Invalid share link format.');
      setLoading(false);
      return;
    }

    setLinkToken(token);
    setRawKeyB64(keyPart || null);

    fetchPublicLinkMetadata(token)
      .then((data) => {
        setMetadata(data);
      })
      .catch((err) => {
        setError(err.message || 'This secret link has expired or reached its maximum download limit.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleDecryptAndDownload() {
    if (!linkToken || !metadata || !rawKeyB64) {
      setError('Decryption key is missing from the link URL. Unable to decrypt.');
      return;
    }

    setDecrypting(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Download encrypted ciphertext from server
      const encryptedBuffer = await downloadPublicEncryptedFile(linkToken);

      // 2. Import raw AES key from URL fragment
      const aesKey = await importRawAesKey(rawKeyB64);

      // 3. Decrypt ciphertext locally in WebCrypto
      const plaintext = await decryptFileContents(
        encryptedBuffer,
        aesKey,
        metadata.aesIv,
        metadata.aesAuthTag
      );

      // 4. Save decrypted file to user disk
      saveFile(plaintext, metadata.filename, metadata.mimeType);
      setSuccess(`File "${metadata.filename}" decrypted successfully in your browser and saved.`);

      if (metadata.isBurnOnRead) {
        setMetadata((prev) => (prev ? { ...prev, remainingDownloads: 0 } : null));
      }
    } catch (err) {
      setError(`Decryption failed: ${(err as Error).message}`);
    } finally {
      setDecrypting(false);
    }
  }

  function handleGoHome() {
    window.location.hash = '';
    window.location.reload();
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="auth-wrapper" style={{ maxWidth: '520px', margin: '4rem auto' }}>
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', color: '#38bdf8', marginBottom: '1rem' }}>
          <LockIcon size={36} />
        </div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Secure Drop E2EE Delivery</h2>
        <p className="hint" style={{ margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
          An end-to-end encrypted document has been shared with you
        </p>

        {loading && <p style={{ color: '#94a3b8' }}>Verifying secret link validity...</p>}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left', color: '#fca5a5' }}>
            <AlertCircleIcon size={20} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {metadata && (
          <div style={{ textAlign: 'left', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileIcon size={24} style={{ color: '#38bdf8' }} />
                <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#f8fafc' }}>
                  {metadata.filename}
                </span>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {formatSize(metadata.size)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {metadata.isBurnOnRead ? (
                <span style={{ fontSize: '0.75rem', color: '#fb923c', background: 'rgba(251, 146, 60, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(251, 146, 60, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <FlameIcon size={13} />
                  <span>Burn on Read (1 download only)</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <DownloadIcon size={13} />
                  <span>{metadata.remainingDownloads !== null ? `${metadata.remainingDownloads} downloads left` : 'Unlimited downloads'}</span>
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ClockIcon size={13} />
                <span>Expires {new Date(metadata.expiresAt).toLocaleDateString()} {new Date(metadata.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderLeft: '3px solid #38bdf8', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong style={{ color: '#e2e8f0' }}>Zero-Knowledge Guarantee:</strong> This file is encrypted. Your browser will download the ciphertext and decrypt it locally using the secret key in this URL. The server never reads the file.
            </div>
          </div>
        )}

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#86efac', textAlign: 'left' }}>
            <CheckCircleIcon size={20} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem' }}>{success}</span>
          </div>
        )}

        {metadata && (
          <button
            onClick={handleDecryptAndDownload}
            disabled={decrypting || !rawKeyB64 || (metadata.remainingDownloads === 0)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              padding: '0.85rem',
              marginBottom: '1rem',
              fontSize: '1rem'
            }}
          >
            {decrypting ? (
              <span>Decrypting in Browser...</span>
            ) : !rawKeyB64 ? (
              <span>Missing Key Fragment in URL</span>
            ) : metadata.remainingDownloads === 0 ? (
              <span>Link Expended (Burned)</span>
            ) : (
              <>
                <DownloadIcon size={18} />
                <span>Decrypt & Save File</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleGoHome}
          className="secondary"
          style={{ width: '100%', fontSize: '0.85rem' }}
        >
          Go to Secure Drop Sign In
        </button>
      </div>
    </div>
  );
}
