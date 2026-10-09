import { useEffect, useState } from 'react';
import { fetchAuditLogs, verifyAuditTrail, type AuditLogEntry, type AuditVerificationResult } from '../api/audit';
import { ShieldIcon, CheckCircleIcon, AlertCircleIcon, RefreshCwIcon, CloseIcon, ActivityIcon } from './icons';

interface AuditLogModalProps {
  visible: boolean;
  token?: string | null;
  onClose: () => void;
}

export function AuditLogModal({ visible, token, onClose }: AuditLogModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !token) return;

    setLoading(true);
    setError(null);

    Promise.all([fetchAuditLogs(token), verifyAuditTrail(token)])
      .then(([logData, verifyData]) => {
        setLogs(logData);
        setVerification(verifyData);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [visible, token]);

  if (!visible) return null;

  async function handleReverify() {
    if (!token) return;
    setVerifying(true);
    try {
      const verifyData = await verifyAuditTrail(token);
      setVerification(verifyData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  function getActionBadgeStyle(action: string) {
    if (action.includes('UPLOAD')) return { background: 'rgba(74, 222, 128, 0.12)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)' };
    if (action.includes('SHARE')) return { background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
    if (action.includes('EPHEMERAL')) return { background: 'rgba(251, 146, 60, 0.12)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.3)' };
    if (action.includes('LOGIN')) return { background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' };
    return { background: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)' };
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '920px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldIcon size={20} style={{ color: '#38bdf8' }} />
              <span>Tamper-Evident Audit Trail</span>
            </h3>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Cryptographically chained immutable access logs
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

        {/* Friendly explanation banner for beginners */}
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '1.25rem' }}>
          Every file upload, download, and share creates a permanent record linked to the previous one using cryptographic SHA-256 hashes. If anyone alters or deletes database records, the verification below will instantly detect it.
        </div>

        {/* Verification Status Banner */}
        {verification && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              background: verification.isValid ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${verification.isValid ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: verification.isValid ? '#4ade80' : '#f87171' }}>
                  {verification.isValid ? <CheckCircleIcon size={26} /> : <AlertCircleIcon size={26} />}
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: verification.isValid ? '#86efac' : '#fca5a5' }}>
                    {verification.isValid ? 'Ledger Integrity Verified: 100% Intact' : 'Cryptographic Tampering Detected!'}
                  </div>
                  <div style={{ margin: '2px 0 0', fontSize: '0.825rem', color: '#94a3b8' }}>
                    {verification.isValid
                      ? `All ${verification.totalEntries} sequential event blocks verified mathematically.`
                      : `Discrepancy at block #${verification.brokenSequence}: ${verification.reason}`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReverify}
                disabled={verifying}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.15)' }}
              >
                <RefreshCwIcon size={14} />
                <span>{verifying ? 'Recalculating...' : 'Re-Verify Ledger'}</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <AlertCircleIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading && <p style={{ color: '#94a3b8' }}>Loading audit records...</p>}

        {/* Logs Table */}
        {!loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <ActivityIcon size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No audit events recorded yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px' }}>
            <table className="file-table" style={{ fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'left', padding: '0.65rem 0.85rem' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Action Event</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Target File</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Chain Hash (Prev to Current)</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ color: '#94a3b8', fontWeight: 600, padding: '0.65rem 0.85rem' }}>{log.sequence}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, ...getActionBadgeStyle(log.action) }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ color: '#e2e8f0', padding: '0.65rem 0.85rem' }}>{log.actorEmail}</td>
                    <td style={{ color: '#cbd5e1', padding: '0.65rem 0.85rem' }}>{log.targetFilename || '-'}</td>
                    <td style={{ color: '#94a3b8', whiteSpace: 'nowrap', padding: '0.65rem 0.85rem' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.75rem', color: '#38bdf8', background: '#0b1120', padding: '3px 6px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {log.previousHash.slice(0, 6)}... to {log.currentHash.slice(0, 6)}...
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Sequential Cryptographic Signature: SHA-256(Block | Action | User | PrevHash)
          </span>
          <button type="button" onClick={onClose} className="secondary" style={{ padding: '0.5rem 1.25rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
