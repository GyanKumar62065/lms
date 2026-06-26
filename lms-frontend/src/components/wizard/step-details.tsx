'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const schema = z.object({
  fullName: z.string().min(1),
  pan: z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, 'Invalid PAN format'),
  dob: z.string().min(1),
  monthlySalary: z.coerce.number().positive(),
  employmentMode: z.enum(['Salaried', 'Self-Employed', 'Unemployed']),
});

const RULE_LABELS: Record<string, string> = {
  AGE: 'Age must be between 23 and 50',
  SALARY: 'Minimum salary ₹25,000/month required',
  PAN: 'PAN format is invalid',
  EMPLOYMENT: 'Unemployed applicants are not eligible',
};

export function StepDetails({ onPassed }: { onPassed: () => void }) {
  const [failed, setFailed] = useState<string[]>([]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFailed([]);
    try {
      await endpoints.putProfile({ ...values, pan: values.pan.toUpperCase() });
      onPassed();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setFailed((e.details as { failedRules?: string[] })?.failedRules ?? []);
      } else {
        toast.error('Could not save details');
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {failed.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Application blocked</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">{failed.map((r) => <li key={r}>{RULE_LABELS[r] ?? r}</li>)}</ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-1"><Label>Full name</Label><Input {...register('fullName')} /></div>
      <div className="space-y-1"><Label>PAN</Label><Input {...register('pan')} placeholder="ABCDE1234F" />
        {errors.pan && <p className="text-sm text-destructive">{String(errors.pan.message)}</p>}</div>
      <div className="space-y-1"><Label>Date of birth</Label><Input type="date" {...register('dob')} /></div>
      <div className="space-y-1"><Label>Monthly salary (₹)</Label><Input type="number" {...register('monthlySalary')} /></div>
      <div className="space-y-1"><Label>Employment</Label>
        <select className="w-full rounded-md border p-2" {...register('employmentMode')}>
          <option value="Salaried">Salaried</option>
          <option value="Self-Employed">Self-Employed</option>
          <option value="Unemployed">Unemployed</option>
        </select>
      </div>
      <Button type="submit" disabled={isSubmitting}>Check & Continue</Button>
    </form>
  );
}
