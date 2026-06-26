import { Schema, model, InferSchemaType, Types } from 'mongoose';
const fileSchema = new Schema(
  { objectKey: String, filename: String, mime: String, size: Number },
  { _id: false },
);
const borrowerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    pan: { type: String, required: true, uppercase: true },
    dob: { type: Date, required: true },
    monthlySalary: { type: Number, required: true }, // paise
    employmentMode: { type: String, enum: ['Salaried', 'Self-Employed', 'Unemployed'], required: true },
    eligibility: {
      passed: { type: Boolean, required: true },
      evaluatedAt: { type: Date, required: true },
      failedRules: [{ type: String }],
    },
    pendingSalarySlip: { type: fileSchema, default: undefined },
    contacted: {
      type: new Schema(
        { flag: Boolean, note: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);
export type IBorrowerProfile = InferSchemaType<typeof borrowerProfileSchema> & { _id: Types.ObjectId };
export const BorrowerProfile = model('BorrowerProfile', borrowerProfileSchema);
export { fileSchema };
