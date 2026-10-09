import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFileAclEntry {
  user: Types.ObjectId;
  encryptedAesKey: string; // base64 RSA-OAEP ciphertext
}

export interface IFile extends Document {
  owner: Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  gridFsId: Types.ObjectId;
  aesIv: string;
  aesAuthTag: string;
  isClientEncrypted?: boolean;
  serverWrappedKey?: string;
  serverWrapIv?: string;
  serverWrapAuthTag?: string;
  acl: IFileAclEntry[];
}

const fileAclSchema = new Schema<IFileAclEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    encryptedAesKey: { type: String, required: true }
  },
  { _id: false }
);

const fileSchema = new Schema<IFile>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    aesIv: { type: String, required: true },
    aesAuthTag: { type: String, required: true },
    isClientEncrypted: { type: Boolean, default: false },
    serverWrappedKey: { type: String, default: '' },
    serverWrapIv: { type: String, default: '' },
    serverWrapAuthTag: { type: String, default: '' },
    acl: { type: [fileAclSchema], default: [] }
  },
  { timestamps: true }
);

export const FileModel = mongoose.model<IFile>('File', fileSchema);


