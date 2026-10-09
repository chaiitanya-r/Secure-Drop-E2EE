import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { FileModel } from '../models/File.js';
import { verifyAuditChain } from '../security/auditChain.js';

export async function getAuditLogs(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

  let query = {};
  if (req.user.role !== 'admin') {
    // If not admin, return events where user was actor OR events for files they own/have access to
    const userFiles = await FileModel.find({
      $or: [{ owner: req.user._id }, { 'acl.user': req.user._id }]
    }).select('_id');
    const userFileIds = userFiles.map((f) => f._id);

    query = {
      $or: [
        { actorId: req.user.id },
        { targetFileId: { $in: userFileIds } }
      ]
    };
  }

  const logs = await AuditLog.find(query)
    .sort({ sequence: -1 })
    .limit(limit);

  res.json(
    logs.map((log) => ({
      id: log.id,
      sequence: log.sequence,
      timestamp: log.timestamp,
      action: log.action,
      actorEmail: log.actorEmail,
      targetFilename: log.targetFilename,
      targetFileId: log.targetFileId,
      details: log.details,
      previousHash: log.previousHash,
      currentHash: log.currentHash
    }))
  );
}

export async function verifyAuditChainStatus(_req: Request, res: Response) {
  const result = await verifyAuditChain();
  res.json(result);
}
