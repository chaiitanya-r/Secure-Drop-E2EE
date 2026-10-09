import type { FileRecord } from '../types/api';
import { FileIcon, DownloadIcon, ShareIcon, ShieldIcon, InfoIcon, LockIcon } from './icons';

interface FileListProps {
  files: FileRecord[];
  onDownload: (file: FileRecord) => void;
  onShare: (file: FileRecord) => void;
  onInspect?: (file: FileRecord) => void;
  downloadingId?: string | null;
}

export function FileList({ files, onDownload, onShare, onInspect, downloadingId }: FileListProps) {
  if (!files.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', color: '#38bdf8', marginBottom: '1rem' }}>
          <FileIcon size={36} />
        </div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#f1f5f9' }}>No Files in Vault Yet</h4>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', maxWidth: '380px', marginInline: 'auto' }}>
          Upload your first document above. It will be encrypted locally on your device with military-grade AES-256 before upload.
        </p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="file-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>File Name</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Protection Level</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Size</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Access Role</th>
            <th style={{ textAlign: 'right', padding: '0.75rem 1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', color: '#38bdf8' }}>
                    <FileIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{file.filename}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{file.mimeType}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '0.9rem 1rem' }}>
                {file.isClientEncrypted ? (
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.25)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <LockIcon size={12} />
                    <span>Zero-Knowledge (Client)</span>
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.25)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldIcon size={12} />
                    <span>Server-Wrapped Key</span>
                  </span>
                )}
              </td>
              <td style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                {formatSize(file.size)}
              </td>
              <td style={{ padding: '0.9rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', color: file.isOwner ? '#cbd5e1' : '#94a3b8' }}>
                  {file.isOwner ? 'Owner' : 'Shared With Me'}
                </span>
              </td>
              <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onDownload(file)}
                    disabled={downloadingId === file.id}
                    title="Decrypt locally and download"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                  >
                    <DownloadIcon size={15} />
                    <span>{downloadingId === file.id ? 'Decrypting...' : 'Download'}</span>
                  </button>

                  {file.isOwner && (
                    <button
                      onClick={() => onShare(file)}
                      className="secondary"
                      title="Share file with user or create one-time link"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                    >
                      <ShareIcon size={15} />
                      <span>Share</span>
                    </button>
                  )}

                  {onInspect && (
                    <button
                      type="button"
                      onClick={() => onInspect(file)}
                      className="secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                      title="Inspect encryption details, IV, and cryptographic tags"
                    >
                      <InfoIcon size={15} />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
