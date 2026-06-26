import { endpoints } from '@/lib/api/endpoints';

function dnt(): boolean {
  return typeof navigator !== 'undefined' && (navigator as any).doNotTrack === '1';
}

export async function track(name: string, props: { path?: string; referrer?: string; utm?: any } = {}) {
  if (dnt()) return;
  const path = props.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  const referrer = props.referrer ?? (typeof document !== 'undefined' ? document.referrer || undefined : undefined);
  await endpoints.track([{ name, path, referrer, utm: props.utm, ts: new Date().toISOString() }]);
}

export const trackLandingView = () => track('landing_view');
export const trackApplyClicked = () => track('apply_clicked');
export const trackSignupStarted = () => track('signup_started');
export const trackSignupCompleted = () => track('signup_completed');
export const trackApplicationSubmitted = () => track('application_submitted');
