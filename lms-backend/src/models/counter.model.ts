import { Schema, model, ClientSession } from 'mongoose';
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = model('Counter', counterSchema);
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return doc!.seq;
}
