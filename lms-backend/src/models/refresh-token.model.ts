import { Schema, model, InferSchemaType, Types } from 'mongoose';
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sid: { type: String, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    createdByIp: { type: String },
  },
  { timestamps: true },
);
export type IRefreshToken = InferSchemaType<typeof refreshTokenSchema> & { _id: Types.ObjectId };
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
