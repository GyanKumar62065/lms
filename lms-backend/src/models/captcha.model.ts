import { Schema, model, InferSchemaType, Types } from 'mongoose';
const captchaSchema = new Schema(
  {
    answerHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
// TTL: Mongo removes the doc once expiresAt passes
captchaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type ICaptcha = InferSchemaType<typeof captchaSchema> & { _id: Types.ObjectId };
export const Captcha = model('Captcha', captchaSchema);
