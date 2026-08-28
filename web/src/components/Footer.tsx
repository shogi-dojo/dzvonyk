import React from 'react';
import { Calendar, FileText, Shield, Code2, Languages } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

// SPDX-License-Identifier: AGPL-3.0-or-later
const SOURCE_URL = 'https://github.com/shogi-dojo/dzvonyk';

export function Footer() {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();

  const changeLang = (lng: 'uk' | 'en') => {
    void i18n.changeLanguage(lng);
  };
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'uk';

  return (
    <footer
      className="no-print border-t border-border bg-card/50 mt-auto"
      role="contentinfo"
      aria-label={t('app.name')}
    >
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid gap-8 md:grid-cols-3">
          {/* About Section */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">{t('app.name')}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('footer.aboutLead')}
              <br/>
              {t('footer.aboutTech')}
            </p>

            {/* Language toggle */}
            <div className="flex items-center gap-2 pt-2" role="group" aria-label={t('footer.language')}>
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <button
                type="button"
                onClick={() => changeLang('uk')}
                aria-pressed={current === 'uk'}
                className={`text-xs px-2 py-1 rounded transition-colors ${current === 'uk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}
              >
                {t('lang.uk')}
              </button>
              <button
                type="button"
                onClick={() => changeLang('en')}
                aria-pressed={current === 'en'}
                className={`text-xs px-2 py-1 rounded transition-colors ${current === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}
              >
                {t('lang.en')}
              </button>
            </div>
          </div>

          {/* Links Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              {t('footer.legal')}
            </h3>
            <nav aria-label={t('footer.legal')}>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/privacy-policy.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('footer.privacy')}
                  </a>
                </li>
                <li>
                  <a
                    href="/terms-conditions.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('footer.terms')}
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    title={t('footer.sourceCodeTitle')}
                  >
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('footer.sourceCode')}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            <Trans
              i18nKey="footer.copyright"
              values={{ year: currentYear, fet: 'FET', license: 'AGPL v3' }}
              components={{
                1: <a href="https://lalescu.ro/liviu/fet/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" />,
                2: <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" />,
              }}
            />
          </p>
        </div>
      </div>
    </footer>
  );
}
