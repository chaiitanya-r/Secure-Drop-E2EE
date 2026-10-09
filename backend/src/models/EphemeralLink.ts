import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEphemeralLink extends Document {
  file: Types.ObjectId;
  token: string;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  maxDownloads: number; // 0 for unlimited, 1 for burn-on-read
  downloadCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ephemeralLinkSchema = new Schema<IEphemeralLink>(
  {
    file: { type: Schema.Types.ObjectId, ref: 'File', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: true },
    maxDownloads: { type: Number, default: 1 },
    downloadCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

export const EphemeralLink = mongoose.model<IEphemeralLink>(
  'EphemeralLink',
  ephemeralLinkSchema
);
