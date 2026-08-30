import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { getConsentStatus, setConsentStatus, CONSENT_CHANGED_EVENT } from '../lib/analytics';

export function ConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => getConsentStatus() === null);

  useEffect(() => {
    const handleConsentChanged = () => {
      setVisible(getConsentStatus() === null);
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChanged);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChanged);
    };
  }, []);

  if (!visible) return null;

  const handleAccept = async () => {
    await setConsentStatus('granted');
    setVisible(false);
  };

  const handleDecline = async () => {
    await setConsentStatus('denied');
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t('analytics.bannerTitle', 'Згода на використання аналітики')}
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 p-4 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl animate-slide-up no-print"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 text-sm space-y-2">
          <p className="font-semibold text-foreground">
            {t('analytics.bannerTitle', 'Анонімна статистика')}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t(
              'analytics.bannerText',
              'Ми збираємо лише узагальнену технічну статистику (перегляди сторінок, швидкість генерації). Назви шкіл, розклади та імена вчителів ніколи не передаються.'
            )}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleAccept} className="text-xs h-8 px-3">
              {t('analytics.accept', 'Прийняти')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} className="text-xs h-8 px-3">
              {t('analytics.decline', 'Відхилити')}
            </Button>
            <Link
              to="/settings"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
            >
              {t('analytics.moreInfo', 'Детальніше')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
