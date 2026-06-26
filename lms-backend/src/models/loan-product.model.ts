import { Schema, model, InferSchemaType, Types } from 'mongoose';

const eligibilitySchema = new Schema(
  {
    minAge: { type: Number, required: true },
    maxAge: { type: Number, required: true },
    minMonthlySalary: { type: Number, required: true }, // paise
    employmentModes: { type: [String], required: true },
  },
  { _id: false },
);

const loanProductSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    interestRate: { type: Number, required: true }, // % p.a.
    minPrincipal: { type: Number, required: true }, // paise
    maxPrincipal: { type: Number, required: true }, // paise
    minTenureDays: { type: Number, required: true },
    maxTenureDays: { type: Number, required: true },
    eligibility: { type: eligibilitySchema, required: true },
    category: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

export type ILoanProduct = InferSchemaType<typeof loanProductSchema> & { _id: Types.ObjectId };
export const LoanProduct = model('LoanProduct', loanProductSchema);
