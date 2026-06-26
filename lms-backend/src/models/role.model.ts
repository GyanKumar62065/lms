import { Schema, model, InferSchemaType, Types } from 'mongoose';

const roleSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type IRole = InferSchemaType<typeof roleSchema> & { _id: Types.ObjectId };
export const Role = model('Role', roleSchema);
