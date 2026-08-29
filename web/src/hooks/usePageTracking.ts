import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, initAnalytics } from '../lib/analytics';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
}
