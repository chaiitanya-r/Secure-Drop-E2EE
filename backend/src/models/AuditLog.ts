import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditAction =
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_SHARE'
  | 'EPHEMERAL_LINK_CREATED'
  | 'EPHEMERAL_LINK_DOWNLOAD'
  | 'EPHEMERAL_LINK_REVOKED';

export interface IAuditLog extends Document {
  sequence: number;
  timestamp: Date;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  targetFileId?: Types.ObjectId;
  targetFilename?: string;
  details?: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now },
    action: {
      type: String,
      required: true,
      enum: [
        'FILE_UPLOAD',
        'FILE_DOWNLOAD',
        'FILE_SHARE',
        'EPHEMERAL_LINK_CREATED',
        'EPHEMERAL_LINK_DOWNLOAD',
        'EPHEMERAL_LINK_REVOKED'
      ]
    },
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
    targetFileId: { type: Schema.Types.ObjectId, ref: 'File' },
    targetFilename: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
    previousHash: { type: String, required: true },
    currentHash: { type: String, required: true, index: true }
  },
  { timestamps: false }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
