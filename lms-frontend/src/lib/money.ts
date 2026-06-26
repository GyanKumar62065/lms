export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
// For money values the backend already returns in rupees (not paise).
export function formatRupeesAmount(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
