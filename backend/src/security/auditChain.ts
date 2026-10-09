import crypto from 'crypto';
import mongoose from 'mongoose';
import { AuditLog, type AuditAction, type IAuditLog } from '../models/AuditLog.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function calculateEntryHash(data: {
  sequence: number;
  timestamp: Date | string;
  action: string;
  actorId: string;
  actorEmail?: string;
  targetFileId?: string;
  targetFilename?: string;
  details?: Record<string, unknown>;
  previousHash: string;
}): string {
  const isoTime = new Date(data.timestamp).toISOString();
  const fileIdStr = data.targetFileId ? data.targetFileId.toString() : '';
  const detailsStr = JSON.stringify(data.details || {});

  const canonicalString = [
    data.sequence,
    isoTime,
    data.action,
    data.actorId,
    data.actorEmail || '',
    fileIdStr,
    data.targetFilename || '',
    detailsStr,
    data.previousHash
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export async function appendAuditLog(params: {
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  targetFileId?: mongoose.Types.ObjectId | string;
  targetFilename?: string;
  details?: Record<string, unknown>;
}): Promise<IAuditLog> {
  // Retrieve the latest link in the cryptographic chain
  const latest = await AuditLog.findOne().sort({ sequence: -1 });

  const sequence = latest ? latest.sequence + 1 : 1;
  const previousHash = latest ? latest.currentHash : GENESIS_HASH;
  const timestamp = new Date();

  const currentHash = calculateEntryHash({
    sequence,
    timestamp,
    action: params.action,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    targetFileId: params.targetFileId?.toString(),
    targetFilename: params.targetFilename,
    details: params.details,
    previousHash
  });

  return AuditLog.create({
    sequence,
    timestamp,
    action: params.action,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    targetFileId: params.targetFileId ? new mongoose.Types.ObjectId(params.targetFileId) : undefined,
    targetFilename: params.targetFilename,
    details: params.details || {},
    previousHash,
    currentHash
  });
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  brokenSequence?: number;
  reason?: string;
  genesisHash: string;
  latestHash?: string;
  verifiedAt: string;
}

export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const entries = await AuditLog.find().sort({ sequence: 1 });
  const verifiedAt = new Date().toISOString();

  if (entries.length === 0) {
    return {
      isValid: true,
      totalEntries: 0,
      genesisHash: GENESIS_HASH,
      verifiedAt
    };
  }

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    // 1. Verify sequence order
    if (entry.sequence !== i + 1) {
      return {
        isValid: false,
        totalEntries: entries.length,
        brokenSequence: entry.sequence,
        reason: `Broken sequence order: expected ${i + 1}, found ${entry.sequence}`,
        genesisHash: GENESIS_HASH,
        verifiedAt
      };
    }

    // 2. Verify previousHash linkage
    const expectedPreviousHash = i === 0 ? GENESIS_HASH : entries[i - 1].currentHash;
    if (entry.previousHash !== expectedPreviousHash) {
      return {
        isValid: false,
        totalEntries: entries.length,
        brokenSequence: entry.sequence,
        reason: `Broken chain link at block #${entry.sequence}: previousHash (${entry.previousHash.slice(0, 8)}...) does not match prior entry currentHash (${expectedPreviousHash.slice(0, 8)}...)`,
        genesisHash: GENESIS_HASH,
        verifiedAt
      };
    }

    // 3. Recompute and verify currentHash integrity
    const recomputedHash = calculateEntryHash({
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      action: entry.action,
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      targetFileId: entry.targetFileId?.toString(),
      targetFilename: entry.targetFilename,
      details: entry.details,
      previousHash: entry.previousHash
    });

    if (recomputedHash !== entry.currentHash) {
      return {
        isValid: false,
        totalEntries: entries.length,
        brokenSequence: entry.sequence,
        reason: `Cryptographic payload tampering at block #${entry.sequence}: calculated hash (${recomputedHash.slice(0, 8)}...) differs from recorded hash (${entry.currentHash.slice(0, 8)}...)`,
        genesisHash: GENESIS_HASH,
        verifiedAt
      };
    }
  }

  return {
    isValid: true,
    totalEntries: entries.length,
    genesisHash: GENESIS_HASH,
    latestHash: entries[entries.length - 1].currentHash,
    verifiedAt
  };
}
