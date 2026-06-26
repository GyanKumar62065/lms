import { Request, Response } from 'express';
import { Role } from '../../models/role.model';

export async function listRoles(_req: Request, res: Response) {
  const roles = await Role.find().populate('permissions', 'code description module');
  res.json({
    data: roles.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: (r.permissions as any[]).map((p) => p.code),
    })),
  });
}
