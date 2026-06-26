import { Schema, model, InferSchemaType } from 'mongoose';

const permissionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true },
    module: { type: String, required: true },
  },
  { timestamps: true },
);

export type IPermission = InferSchemaType<typeof permissionSchema>;
export const Permission = model('Permission', permissionSchema);
