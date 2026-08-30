// SPDX-License-Identifier: AGPL-3.0-or-later
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell, Shield, Code2, FileText, CheckCircle2,
  ExternalLink, Sparkles, Heart, GitBranch, Cpu, Lock, BookOpen
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PageHeader } from '@/components/PageTransition';
import { InstallPwaButton } from '@/components/InstallPwaButton';
import { SOURCE_URL, FEEDBACK_URL, FEEDBACK_EMAIL, DONATE_URL } from '@/lib/links';
import { APP_VERSION } from '@/lib/version';
import { CHANGELOG_RELEASES } from '@/lib/changelog';

const FET_URL = 'https://lalescu.ro/liviu/fet/';

export function About() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-testid="about-page">
      <PageHeader
        title={t('about.title', { defaultValue: 'Про програму «Дзвоник»' })}
        description={t('about.subtitle', { defaultValue: 'Офлайн-планувальник шкільного розкладу для завуча' })}
        icon={<Bell className="h-6 w-6 text-primary fill-current" />}
      />

      {/* Main Info Card */}
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl gradient-primary shadow-md">
                <Bell className="h-8 w-8 text-primary-foreground fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">Дзвоник</h2>
                  <Badge variant="secondary" className="font-mono text-xs">v{APP_VERSION}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Сучасний швидкий планувальник навчальних розкладів
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <InstallPwaButton variant="default" className="gradient-primary text-primary-foreground font-semibold shadow-sm" />
              <Button asChild variant="outline" className="gap-2">
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                  <Code2 className="h-4 w-4" />
                  <span>GitHub Репозиторій</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            «Дзвоник» створено спеціально для диспетчерів та заступників директорів з навчально-виховної роботи українських шкіл, ліцеїв та гімназій. Система дозволяє автоматично генерувати оптимальний розклад уроків без вікон і конфліктів, гнучко коригувати його вручну та готувати офіційні друковані бланки.
          </p>

          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border/80 flex items-start gap-3">
              <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-foreground">Приватність за вибором</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Без входу дані залишаються у вашому браузері. Після входу через Google вибрані робочі простори приватно синхронізуються з Firebase.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-secondary/50 border border-border/80 flex items-start gap-3">
              <Cpu className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-foreground">Рушій FET</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Генерація базується на перевіреному світовому алгоритмі генерації евристичного планування розкладів FET.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-secondary/50 border border-border/80 flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-foreground">Сумісність</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Підтримка імпорту й експорту популярних файлів aSc Розклад (<code className="text-xs font-mono">.roz</code>) та FET (<code className="text-xs font-mono">.fet</code>).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Changelog Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Журнал оновлень (Changelog)</CardTitle>
              <CardDescription>Історія змін та внутрішні етапи розвитку програми</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="multiple" defaultValue={['1.4.0']} className="space-y-3">
            {CHANGELOG_RELEASES.map((release) => {
              const isCurrent = release.version === APP_VERSION;

              return (
                <AccordionItem
                  key={release.version}
                  value={release.version}
                  className="rounded-lg border border-border/80 bg-background/50 px-4 transition-colors"
                >
                  <AccordionTrigger className="hover:no-underline py-3 text-left">
                    <div className="flex items-center gap-2.5 flex-wrap pr-2">
                      <span className="font-bold text-foreground">Версія {release.version}</span>
                      <Badge
                        variant={release.badgeVariant || (isCurrent ? 'default' : 'secondary')}
                        className={isCurrent ? 'bg-primary/20 text-primary border-primary/30' : 'text-xs'}
                      >
                        {release.badge}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-normal">• {release.date}</span>
                      <span className="text-xs font-medium text-foreground/80 hidden sm:inline ml-1">
                        — {release.title}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {release.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-foreground font-medium">{item.feature}</strong>{' '}
                            {item.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Support the project */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('support.title')}</CardTitle>
              <CardDescription>{t('support.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="leading-relaxed">{t('support.free')}</p>
          <p className="leading-relaxed">{t('support.body')}</p>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {DONATE_URL && (
              <Button asChild variant="outline" className="gap-2 justify-start h-auto py-3">
                <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                  <Heart className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{t('support.donate')}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60 ml-auto" />
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="gap-2 justify-start h-auto py-3">
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">{t('support.feedback')}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 ml-auto" />
              </a>
            </Button>
          </div>
          <p className="text-xs leading-relaxed">
            {t('support.feedbackBody', { email: FEEDBACK_EMAIL })}
          </p>
        </CardContent>
      </Card>

      {/* Legal & Open Source License */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Правова інформація та ліцензія</CardTitle>
              <CardDescription>Вільне програмне забезпечення</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            © {currentYear} <strong>«Дзвоник»</strong>. Розповсюджується за вільною ліцензією{' '}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 font-medium"
            >
              GNU Affero General Public License v3.0 (AGPL-3.0)
            </a>.
          </p>
          <p>
            Побудовано на базі відкритого алгоритму{' '}
            <a
              href={FET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 font-medium"
            >
              FET Timetabling
            </a>{' '}
            авторства Ліву Лалеску (Liviu Lalescu).
          </p>

          <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
            <a
              href="/privacy-policy.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span>Політика конфіденційності</span>
            </a>
            <a
              href="/terms-conditions.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>Умови використання</span>
            </a>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Code2 className="h-4 w-4 text-primary" />
              <span>Вихідний код на GitHub (AGPL-3.0)</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
