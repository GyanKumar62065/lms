// src/components/dashboard/charts/chart-container.tsx
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ChartContainer({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div data-testid={testId} className="h-72 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}
