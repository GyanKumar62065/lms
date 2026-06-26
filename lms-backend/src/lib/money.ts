export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) throw new Error('rupees must be finite');
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (!Number.isInteger(paise)) throw new Error('paise must be an integer');
  return paise / 100;
}

export function formatPaise(paise: number): string {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN')}`;
}
