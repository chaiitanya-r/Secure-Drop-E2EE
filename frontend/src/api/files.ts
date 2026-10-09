import { apiFetch, apiFetchBinary } from './client';
import type { FileMetadata, FileRecord } from '../types/api';

export function fetchFiles(token: string) {
  return apiFetch<FileRecord[]>('/api/files', { method: 'GET' }, token);
}

export interface ClientEncryptedUploadPayload {
  encryptedBlob: Blob;
  originalFilename: string;
  originalMimeType: string;
  originalSize: number;
  aesIv: string;
  aesAuthTag: string;
  encryptedAesKey: string;
}

export function uploadClientEncryptedFileRequest(
  token: string,
  payload: ClientEncryptedUploadPayload
) {
  const formData = new FormData();
  formData.append('file', payload.encryptedBlob, payload.originalFilename);
  formData.append('isClientEncrypted', 'true');
  formData.append('originalFilename', payload.originalFilename);
  formData.append('originalMimeType', payload.originalMimeType);
  formData.append('originalSize', payload.originalSize.toString());
  formData.append('aesIv', payload.aesIv);
  formData.append('aesAuthTag', payload.aesAuthTag);
  formData.append('encryptedAesKey', payload.encryptedAesKey);

  return apiFetch<{ id: string; isClientEncrypted: boolean }>(
    '/api/files/upload',
    { method: 'POST', body: formData },
    token
  );
}

export function uploadFileRequest(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<{ id: string }>('/api/files/upload', { method: 'POST', body: formData }, token);
}

export function fetchFileMetadata(token: string, fileId: string) {
  return apiFetch<FileMetadata>(`/api/files/${fileId}`, { method: 'GET' }, token);
}

export function fetchUserPublicKey(token: string, email: string) {
  return apiFetch<{ id: string; email: string; rsaPublicKey: string }>(
    `/api/auth/public-key?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
    token
  );
}

export function shareFileRequest(
  token: string,
  fileId: string,
  targetUserEmail: string,
  encryptedAesKey?: string
) {
  return apiFetch<{ message: string; isZeroKnowledge?: boolean }>(
    `/api/files/${fileId}/share`,
    {
      method: 'POST',
      body: JSON.stringify({
        targetUserEmail,
        ...(encryptedAesKey ? { encryptedAesKey } : {})
      })
    },
    token
  );
}

export function downloadEncryptedFile(token: string, fileId: string) {
  return apiFetchBinary(`/api/files/${fileId}/download`, token);
}

export interface PublicLinkMetadata {
  token: string;
  filename: string;
  mimeType: string;
  size: number;
  aesIv: string;
  aesAuthTag: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  remainingDownloads: number | null;
  isBurnOnRead: boolean;
}

export function createEphemeralLinkRequest(
  token: string,
  fileId: string,
  options: { expiresInHours: number; maxDownloads: number }
) {
  return apiFetch<{
    id: string;
    token: string;
    expiresAt: string;
    maxDownloads: number;
    downloadCount: number;
  }>(
    `/api/files/${fileId}/ephemeral-link`,
    {
      method: 'POST',
      body: JSON.stringify(options)
    },
    token
  );
}

export function fetchPublicLinkMetadata(linkToken: string) {
  return apiFetch<PublicLinkMetadata>(`/api/public/share/${linkToken}`, { method: 'GET' });
}

export function downloadPublicEncryptedFile(linkToken: string) {
  return apiFetchBinary(`/api/public/share/${linkToken}/download`);
}


