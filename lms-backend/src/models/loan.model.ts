import { Schema, model, InferSchemaType, Types } from 'mongoose';
import { fileSchema } from './borrower-profile.model';

const statusHistorySchema = new Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const loanSchema = new Schema(
  {
    loanRef: { type: String, required: true, unique: true, index: true },
    borrower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'LoanProduct' },
    productCode: { type: String },
    productName: { type: String },
    principal: { type: Number, required: true }, // paise
    tenureDays: { type: Number, required: true },
    interestRate: { type: Number, required: true, default: 12 },
    simpleInterest: { type: Number, required: true }, // paise
    totalRepayment: { type: Number, required: true }, // paise
    amountPaid: { type: Number, required: true, default: 0 }, // paise
    outstanding: { type: Number, required: true }, // paise
    status: {
      type: String,
      enum: ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED', 'CANCELLED'],
      default: 'APPLIED',
      index: true,
    },
    salarySlip: { type: fileSchema, required: true },
    sanction: {
      type: new Schema(
        { decidedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, decidedAt: Date },
        { _id: false },
      ),
      default: undefined,
    },
    disbursement: {
      type: new Schema({ by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date }, { _id: false }),
      default: undefined,
    },
    cancellation: {
      type: new Schema({ by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date }, { _id: false }),
      default: undefined,
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true },
);
loanSchema.index({ borrower: 1, status: 1 });
loanSchema.index({ borrower: 1, product: 1, status: 1 });
export type ILoan = InferSchemaType<typeof loanSchema> & { _id: Types.ObjectId };
export const Loan = model('Loan', loanSchema);
