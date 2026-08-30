// SPDX-License-Identifier: AGPL-3.0-or-later
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CircleHelp,
  Search,
  X,
  Rocket,
  Users,
  Shield,
  Grid3X3,
  Maximize2,
  Printer,
  Database,
  ArrowRight,
  AlertTriangle,
  ZoomIn,
  Link2,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/PageTransition';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  type FAQCategoryId,
  type FAQItem,
} from '@/lib/faq/faqData';
import { searchFAQ } from '@/lib/faq/faqSearch';

const CATEGORY_ICONS: Record<FAQCategoryId, React.ComponentType<{ className?: string }>> = {
  start: Rocket,
  entities: Users,
  constraints: Shield,
  timetable: Grid3X3,
  interface: Maximize2,
  print_export: Printer,
  workspaces: Database,
};

export function FAQ() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const targetId = searchParams.get('id') || (location.hash ? location.hash.replace(/^#/, '') : null);
  const queryParam = searchParams.get('q') || '';
  const catParam = searchParams.get('cat') as FAQCategoryId | null;

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [activeCategory, setActiveCategory] = useState<FAQCategoryId | 'all'>(
    catParam && FAQ_CATEGORIES.some((c) => c.id === catParam) ? catParam : 'all'
  );
  const [openItems, setOpenItems] = useState<string[]>(() => (targetId ? [targetId] : []));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    url: string;
    caption?: string;
    alt?: string;
  } | null>(null);

  // Scroll target into view if opened via deep-link
  useEffect(() => {
    if (!targetId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`faq-item-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [targetId]);

  const filteredItems = useMemo(() => {
    return searchFAQ({
      query: searchQuery,
      categoryId: activeCategory,
    });
  }, [searchQuery, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: FAQ_ITEMS.length };
    for (const cat of FAQ_CATEGORIES) {
      counts[cat.id] = FAQ_ITEMS.filter((item) => item.categoryId === cat.id).length;
    }
    return counts;
  }, []);

  const handleCopyLink = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#/faq?id=${itemId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-testid="faq-page">
      <PageHeader
        title={t('faq.title', { defaultValue: 'Довідка та часті запитання' })}
        description={t('faq.subtitle', {
          defaultValue: 'Повний практичний посібник користувача для диспетчерів та завучів',
        })}
        icon={<CircleHelp className="h-6 w-6 text-primary" />}
      />

      {/* Search and Quick Filters */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const nextVal = e.target.value;
                setSearchQuery(nextVal);
                if (nextVal) {
                  setSearchParams({ q: nextVal });
                } else {
                  setSearchParams({});
                }
              }}
              placeholder="Пошук у довідці (наприклад: чисельник, імпорт roz, вікна, друк, санітарні норми)..."
              className="pl-10 pr-10 h-11 text-base bg-background"
              aria-label="Пошук у довідці"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery('');
                  setSearchParams({});
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Очистити пошук"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-1" role="tablist" aria-label="Категорії довідки">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveCategory('all');
                setSearchParams({});
              }}
              className="h-8 gap-1.5 rounded-full text-xs font-medium"
            >
              <span>Усі теми</span>
              <Badge
                variant={activeCategory === 'all' ? 'secondary' : 'outline'}
                className="px-1.5 py-0 text-[10px] font-mono ml-0.5"
              >
                {categoryCounts.all}
              </Badge>
            </Button>

            {FAQ_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const isSelected = activeCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchParams({ cat: cat.id });
                  }}
                  className="h-8 gap-1.5 rounded-full text-xs font-medium"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{cat.title}</span>
                  <Badge
                    variant={isSelected ? 'secondary' : 'outline'}
                    className="px-1.5 py-0 text-[10px] font-mono ml-0.5"
                  >
                    {categoryCounts[cat.id] || 0}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground">
          {searchQuery ? (
            <>
              За запитом «<span className="font-semibold text-foreground">{searchQuery}</span>» знайдено:{' '}
              <strong className="text-foreground">{filteredItems.length}</strong>
            </>
          ) : (
            <>
              Показано запитань: <strong className="text-foreground">{filteredItems.length}</strong>
            </>
          )}
        </div>
      </div>

      {/* FAQ Accordion List */}
      {filteredItems.length === 0 ? (
        <Card className="border-border bg-card text-center p-8">
          <div className="max-w-md mx-auto space-y-3">
            <div className="p-3 rounded-full bg-muted w-12 h-12 flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-foreground text-lg">Нічого не знайдено</h3>
            <p className="text-sm text-muted-foreground">
              За вашим запитом не знайдено запитань. Спробуйте змінити ключове слово або переглянути всі теми.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setSearchParams({});
              }}
              className="mt-2"
            >
              Скинути фільтри
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-border bg-card overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <Accordion
              type="multiple"
              value={openItems}
              onValueChange={setOpenItems}
              className="w-full divide-y divide-border"
            >
              {filteredItems.map((item: FAQItem) => {
                const category = FAQ_CATEGORIES.find((c) => c.id === item.categoryId);
                const CatIcon = category ? CATEGORY_ICONS[category.id] : CircleHelp;
                const isCopied = copiedId === item.id;

                return (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    id={`faq-item-${item.id}`}
                    className="border-b-0 py-1"
                  >
                    <AccordionTrigger className="hover:no-underline py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3 text-left pr-4 flex-1">
                        <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0 mt-0.5">
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm sm:text-base">
                              {item.question}
                            </span>
                            {item.isDestructive && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Небезпечна дія
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-normal">
                            {category?.title}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-2 pb-4 space-y-4">
                      {/* Destructive Warning Box */}
                      {item.isDestructive && item.warningText && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{item.warningText}</span>
                        </div>
                      )}

                      {/* Text content formatted */}
                      <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line pl-9">
                        {item.answer}
                      </div>

                      {/* Optional Screenshot (.webp with fallback) */}
                      {item.screenshotId && (
                        <div className="pl-9 pt-2">
                          <div
                            className="group relative inline-block rounded-lg overflow-hidden border border-border bg-muted/40 cursor-pointer max-w-lg shadow-sm hover:shadow-md transition-all"
                            onClick={() =>
                              setSelectedScreenshot({
                                url: `/faq/${item.screenshotId}.webp`,
                                caption: item.screenshotCaption,
                                alt: item.screenshotAlt,
                              })
                            }
                          >
                            <picture>
                              <source srcSet={`/faq/${item.screenshotId}.webp`} type="image/webp" />
                              <img
                                src={`/faq/${item.screenshotId}.png`}
                                alt={item.screenshotAlt || item.question}
                                loading="lazy"
                                className="w-full max-h-56 object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                                onError={(e) => {
                                  // Gracefully hide thumbnail if asset missing
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </picture>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-medium">
                              <ZoomIn className="h-4 w-4" />
                              <span>Натисніть для збільшення</span>
                            </div>
                            {item.screenshotCaption && (
                              <div className="p-2 text-xs text-muted-foreground bg-card border-t border-border flex items-center justify-between">
                                <span>{item.screenshotCaption}</span>
                                <ZoomIn className="h-3 w-3 opacity-60 ml-2 shrink-0" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom action row: Route link + Copy direct link */}
                      <div className="pl-9 pt-1 flex items-center gap-2 flex-wrap">
                        {item.routeLink && (
                          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Link to={item.routeLink.path}>
                              <span>{item.routeLink.label}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleCopyLink(e, item.id)}
                          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
                          title="Скопіювати пряме посилання на це запитання"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-primary" />
                              <span className="text-primary font-medium">Посилання скопійовано!</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3.5 w-3.5" />
                              <span>Пряме посилання</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Screenshot Zoom Modal */}
      <Dialog open={!!selectedScreenshot} onOpenChange={(open) => !open && setSelectedScreenshot(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {selectedScreenshot?.caption || 'Знімок інтерфейсу'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/20">
            {selectedScreenshot && (
              <picture>
                <source srcSet={selectedScreenshot.url} type="image/webp" />
                <img
                  src={selectedScreenshot.url.replace(/\.webp$/, '.png')}
                  alt={selectedScreenshot.alt || selectedScreenshot.caption || 'Знімок інтерфейсу'}
                  className="w-full h-auto max-h-[75vh] object-contain mx-auto"
                />
              </picture>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
