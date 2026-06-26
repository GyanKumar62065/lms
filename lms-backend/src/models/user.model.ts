import { Schema, model, InferSchemaType, Types } from 'mongoose';

const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String, unique: true, sparse: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    // Single active session: the id of the user's current session. A login elsewhere
    // rotates this, immediately invalidating any access/refresh token from a prior session.
    sessionId: { type: String, default: null },
  },
  { timestamps: true },
);

export type IUser = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);
