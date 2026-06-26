import { cookies } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function RolesPage() {
  await requirePermission('rbac:read');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await endpoints.roles({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck size={20} />Roles & Permissions</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((role) => (
          <Card key={role.code}>
            <CardHeader><CardTitle className="text-base">{role.name}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {role.permissions.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
