export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  rsaPublicKey?: string;
  encryptedPrivateKey: string;
  privateKeySalt: string;
  privateKeyIv: string;
}

export interface LoginResponse {
  token: string;
  user: AuthenticatedUser;
}

export interface FileRecord {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isOwner: boolean;
  isClientEncrypted?: boolean;
}

export interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  aesIv: string;
  aesAuthTag: string;
  encryptedAesKey: string;
  isClientEncrypted?: boolean;
}


