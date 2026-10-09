import { apiFetch } from './client';

export interface AuditLogEntry {
  id: string;
  sequence: number;
  timestamp: string;
  action: string;
  actorEmail: string;
  targetFilename?: string;
  targetFileId?: string;
  details?: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalEntries: number;
  brokenSequence?: number;
  reason?: string;
  genesisHash: string;
  latestHash?: string;
  verifiedAt: string;
}

export function fetchAuditLogs(token: string) {
  return apiFetch<AuditLogEntry[]>('/api/audit', { method: 'GET' }, token);
}

export function verifyAuditTrail(token: string) {
  return apiFetch<AuditVerificationResult>('/api/audit/verify', { method: 'GET' }, token);
}
