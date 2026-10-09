import { useState } from 'react';
import type { FormEvent } from 'react';
import { uploadClientEncryptedFileRequest, uploadFileRequest } from '../api/files';
import { useAuthContext } from '../contexts/AuthContext';
import { encryptFileClientSide } from '../lib/crypto';
import { UploadCloudIcon, ShieldIcon, FileIcon, CheckCircleIcon, ActivityIcon, CloseIcon } from './icons';

interface FileUploadProps {
  onUploaded: () => void;
}

export function FileUpload({ onUploaded }: FileUploadProps) {
  const { token, user } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cryptoStage, setCryptoStage] = useState<string | null>(null);

  if (!token) {
    return null;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !token) return;
    setLoading(true);
    setStatus(null);
    try {
      if (user?.rsaPublicKey) {
        setCryptoStage('Generating 256-bit AES-GCM key and random nonce...');
        const encryptedResult = await encryptFileClientSide(file, user.rsaPublicKey);

        setCryptoStage('Encrypting file payload and wrapping key with RSA-OAEP...');
        await new Promise((r) => setTimeout(r, 200));

        setCryptoStage('Storing encrypted ciphertext in secure vault...');
        await uploadClientEncryptedFileRequest(token, {
          encryptedBlob: encryptedResult.encryptedBlob,
          originalFilename: file.name,
          originalMimeType: file.type || 'application/octet-stream',
          originalSize: file.size,
          aesIv: encryptedResult.aesIv,
          aesAuthTag: encryptedResult.aesAuthTag,
          encryptedAesKey: encryptedResult.encryptedAesKey
        });

        setStatus(`Successfully encrypted and uploaded "${file.name}". Plaintext never leaves your machine.`);
      } else {
        setCryptoStage('Uploading file...');
        await uploadFileRequest(token, file);
        setStatus('File uploaded successfully.');
      }

      setFile(null);
      onUploaded();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
      setCryptoStage(null);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <form className="card" onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloudIcon size={20} style={{ color: '#38bdf8' }} />
            <span>Upload & Encrypt File</span>
          </h3>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Files are automatically locked with AES-256-GCM encryption in your browser before transfer.
          </p>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.25)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ShieldIcon size={14} />
          <span>Zero-Knowledge Protection</span>
        </span>
      </div>

      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(15, 23, 42, 0.4)',
          transition: 'all 0.2s ease',
          marginBottom: '1rem',
          cursor: 'pointer'
        }}
      >
        <input
          id="file-input"
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setStatus(null);
          }}
        />
        <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(30, 41, 59, 0.8)', padding: '0.85rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <FileIcon size={28} style={{ color: '#38bdf8' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formatSize(file.size)}</div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFile(null);
                }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', marginLeft: '8px' }}
                title="Remove file"
              >
                <CloseIcon size={18} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', color: '#38bdf8', marginBottom: '4px' }}>
                <UploadCloudIcon size={32} />
              </div>
              <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>
                Drag and drop your file here, or click to browse
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Supports all file types up to 25 MB
              </div>
            </>
          )}
        </label>
      </div>

      {cryptoStage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', color: '#7dd3fc', marginBottom: '1rem' }}>
          <ActivityIcon size={18} />
          <span>{cryptoStage}</span>
        </div>
      )}

      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', color: '#86efac', marginBottom: '1rem' }}>
          <CheckCircleIcon size={18} />
          <span>{status}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          padding: '0.75rem',
          opacity: (!file || loading) ? 0.6 : 1
        }}
      >
        {loading ? (
          <span>Encrypting & Storing...</span>
        ) : (
          <>
            <ShieldIcon size={18} />
            <span>Encrypt & Upload File</span>
          </>
        )}
      </button>
    </form>
  );
}
