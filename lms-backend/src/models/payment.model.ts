import { Schema, model, InferSchemaType, Types } from 'mongoose';
const paymentSchema = new Schema(
  {
    loan: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    utr: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true }, // paise
    paidAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
export type IPayment = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const Payment = model('Payment', paymentSchema);
