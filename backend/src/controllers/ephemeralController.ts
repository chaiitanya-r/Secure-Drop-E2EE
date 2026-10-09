import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { EphemeralLink } from '../models/EphemeralLink.js';
import { FileModel } from '../models/File.js';
import { getGridFsBucket } from '../storage/gridfs.js';
import { appendAuditLog } from '../security/auditChain.js';

function ensureObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('InvalidObjectId');
  }
}

export async function createEphemeralLink(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    ensureObjectId(req.params.fileId);
  } catch {
    return res.status(400).json({ message: 'Invalid file id' });
  }

  const file = await FileModel.findById(req.params.fileId);
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const hasAccess = file.owner.equals(req.user._id) || file.acl.some((e) => e.user.equals(req.user!._id));
  if (!hasAccess) {
    return res.status(403).json({ message: 'No access to file' });
  }

  const expiresInHours = Math.min(Math.max(Number(req.body.expiresInHours) || 24, 1), 168); // 1 hr to 7 days
  const maxDownloads = req.body.maxDownloads !== undefined ? Math.max(Number(req.body.maxDownloads), 0) : 1; // default 1 (burn on read)

  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const link = await EphemeralLink.create({
    file: file._id,
    token,
    createdBy: req.user._id,
    expiresAt,
    maxDownloads,
    downloadCount: 0,
    isActive: true
  });

  await appendAuditLog({
    action: 'EPHEMERAL_LINK_CREATED',
    actorId: req.user.id,
    actorEmail: req.user.email,
    targetFileId: file._id,
    targetFilename: file.filename,
    details: { token: link.token, maxDownloads, expiresInHours }
  });

  res.status(201).json({
    id: link.id,
    token: link.token,
    expiresAt: link.expiresAt,
    maxDownloads: link.maxDownloads,
    downloadCount: link.downloadCount
  });
}

export async function getPublicLinkMetadata(req: Request, res: Response) {
  const token = req.params.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Missing token' });
  }

  const link = await EphemeralLink.findOne({ token, isActive: true });
  if (!link) {
    return res.status(410).json({ message: 'Secret link not found or already deactivated' });
  }

  const now = new Date();
  if (link.expiresAt < now) {
    link.isActive = false;
    await link.save();
    return res.status(410).json({ message: 'Secret link has expired' });
  }

  if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
    link.isActive = false;
    await link.save();
    return res.status(410).json({ message: 'Secret link has reached maximum download limit (Burned on read)' });
  }

  const file = await FileModel.findById(link.file);
  if (!file) {
    return res.status(404).json({ message: 'Underlying file no longer exists' });
  }

  const remainingDownloads = link.maxDownloads > 0 ? Math.max(link.maxDownloads - link.downloadCount, 0) : null;

  res.json({
    token: link.token,
    filename: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    aesIv: file.aesIv,
    aesAuthTag: file.aesAuthTag,
    expiresAt: link.expiresAt,
    maxDownloads: link.maxDownloads,
    downloadCount: link.downloadCount,
    remainingDownloads,
    isBurnOnRead: link.maxDownloads === 1
  });
}

export async function downloadPublicFile(req: Request, res: Response) {
  const token = req.params.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Missing token' });
  }

  const link = await EphemeralLink.findOne({ token, isActive: true });
  if (!link) {
    return res.status(410).json({ message: 'Secret link not found or expired' });
  }

  const now = new Date();
  if (link.expiresAt < now) {
    link.isActive = false;
    await link.save();
    return res.status(410).json({ message: 'Secret link has expired' });
  }

  if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
    link.isActive = false;
    await link.save();
    return res.status(410).json({ message: 'Secret link download limit exceeded (Burned on read)' });
  }

  const file = await FileModel.findById(link.file);
  if (!file) {
    return res.status(404).json({ message: 'Underlying file no longer exists' });
  }

  // Increment download count and deactivate if reached max
  link.downloadCount += 1;
  if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
    link.isActive = false;
  }
  await link.save();

  const bucket = getGridFsBucket();
  const safeName = encodeURIComponent(`${file.filename}.enc`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
  res.setHeader('x-file-mime', file.mimeType);
  res.setHeader('x-aes-iv', file.aesIv);
  res.setHeader('x-aes-tag', file.aesAuthTag);

  const downloadStream = bucket.openDownloadStream(file.gridFsId);
  downloadStream.on('error', () => res.status(500).end());
  downloadStream.pipe(res);

  await appendAuditLog({
    action: 'EPHEMERAL_LINK_DOWNLOAD',
    actorId: 'ANONYMOUS_PUBLIC_USER',
    actorEmail: 'anonymous@secret-link',
    targetFileId: file._id,
    targetFilename: file.filename,
    details: {
      token: link.token,
      downloadCount: link.downloadCount,
      maxDownloads: link.maxDownloads,
      remainingDownloads: link.maxDownloads > 0 ? Math.max(link.maxDownloads - link.downloadCount, 0) : null
    }
  });
}

export async function listFileEphemeralLinks(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    ensureObjectId(req.params.fileId);
  } catch {
    return res.status(400).json({ message: 'Invalid file id' });
  }

  const links = await EphemeralLink.find({
    file: req.params.fileId,
    createdBy: req.user._id
  }).sort({ createdAt: -1 });

  res.json(
    links.map((link) => ({
      id: link.id,
      token: link.token,
      expiresAt: link.expiresAt,
      maxDownloads: link.maxDownloads,
      downloadCount: link.downloadCount,
      isActive: link.isActive && link.expiresAt > new Date() && (link.maxDownloads === 0 || link.downloadCount < link.maxDownloads)
    }))
  );
}

export async function revokeEphemeralLink(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    ensureObjectId(req.params.linkId);
  } catch {
    return res.status(400).json({ message: 'Invalid link id' });
  }

  const link = await EphemeralLink.findOne({
    _id: req.params.linkId,
    createdBy: req.user._id
  });

  if (!link) {
    return res.status(404).json({ message: 'Link not found' });
  }

  link.isActive = false;
  await link.save();

  await appendAuditLog({
    action: 'EPHEMERAL_LINK_REVOKED',
    actorId: req.user.id,
    actorEmail: req.user.email,
    targetFileId: link.file,
    details: { linkId: link.id, token: link.token }
  });

  res.json({ message: 'Link successfully revoked' });
}
