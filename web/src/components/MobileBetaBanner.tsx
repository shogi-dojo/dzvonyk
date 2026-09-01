import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info } from 'lucide-react';

const STORAGE_KEY = 'dzvonyk.mobileBetaDismissed';
const MOBILE_QUERY = '(max-width: 639.98px)';

export function MobileBetaBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setVisible(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      role="status"
      data-testid="mobile-beta-banner"
      className="flex items-center gap-2 border-b border-border bg-warning/15 px-3 py-2 text-xs text-foreground lg:hidden no-print"
    >
      <Info className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="flex-1 min-w-0">{t('mobileBanner.text')}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('mobileBanner.dismiss')}
        className="shrink-0 rounded p-1 hover:bg-background/60 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
