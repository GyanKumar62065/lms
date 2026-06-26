'use client';
import { useEffect } from 'react';
import { trackLandingView } from '@/lib/analytics';

export function LandingView() {
  useEffect(() => {
    trackLandingView();
  }, []);
  return null;
}
