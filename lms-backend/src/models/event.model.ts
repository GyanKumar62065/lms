import { Schema, model, InferSchemaType, Types } from 'mongoose';
const eventSchema = new Schema(
  {
    name: { type: String, required: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    path: String,
    referrer: String,
    utm: { source: String, medium: String, campaign: String },
    userAgent: String,
    ip: String,
    ts: { type: Date, required: true },
  },
  { timestamps: true },
);
eventSchema.index({ name: 1, ts: -1 });
export type IEvent = InferSchemaType<typeof eventSchema> & { _id: Types.ObjectId };
export const Event = model('Event', eventSchema);
