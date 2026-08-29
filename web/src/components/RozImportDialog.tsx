import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { AlertCircle, AlertTriangle, CheckCircle2, School, Calendar, BookOpen, Users, UserCheck } from 'lucide-react';
import type { RozImportResult } from '../lib/rozParser';

interface RozImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: RozImportResult | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  importing: boolean;
}

export function RozImportDialog({
  open,
  onOpenChange,
  result,
  onConfirm,
  onCancel,
  importing,
}: RozImportDialogProps) {
  const { t } = useTranslation();

  if (!result) return null;

  const { report } = result;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? handleCancel() : onOpenChange(true))}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <School className="h-5 w-5 text-primary" />
            {t('rozImport.previewTitle')}
          </DialogTitle>
          <DialogDescription>
            {report.schoolName} {report.year ? `(${report.year})` : ''}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 max-h-[60vh]">
          <div className="space-y-5">
            {/* Header info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="p-2.5 rounded-lg bg-muted/50 border flex flex-col items-center justify-center text-center">
                <Users className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{t('rozImport.classes')}</span>
                <span className="font-semibold text-base">{report.counts.classes}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border flex flex-col items-center justify-center text-center">
                <UserCheck className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{t('rozImport.teachers')}</span>
                <span className="font-semibold text-base">{report.counts.teachers}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border flex flex-col items-center justify-center text-center">
                <BookOpen className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{t('rozImport.subjects')}</span>
                <span className="font-semibold text-base">{report.counts.subjects}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border flex flex-col items-center justify-center text-center">
                <Calendar className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{t('rozImport.hours')}</span>
                <span className="font-semibold text-base">{report.counts.hours}</span>
              </div>
            </div>

            {/* Counts table */}
            <div className="rounded-lg border bg-card text-card-foreground p-3 text-xs space-y-1.5">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{t('rozImport.lessons')}</span>
                <span className="font-medium">{report.counts.lessons}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{t('rozImport.subgroups')}</span>
                <span className="font-medium">{report.counts.subgroups}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{t('rozImport.placements')}</span>
                <span className="font-medium text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 inline" />
                  {report.counts.placements}
                </span>
              </div>
              {report.unplacedHours > 0 && (
                <div className="flex justify-between py-1 text-destructive font-medium">
                  <span>{t('rozImport.unplaced')}</span>
                  <span>{report.unplacedHours} {t('rozImport.hoursSuffix')}</span>
                </div>
              )}
            </div>

            {/* Warnings */}
            {report.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('rozImport.warningsTitle')}
                </div>
                <div className="space-y-1.5">
                  {report.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{t(`rozImport.${w.key}`, w.params || {})}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample decoded lessons */}
            {report.sampleLessons.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('rozImport.sampleLessonsTitle')}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                  {report.sampleLessons.map((lesson, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-muted/40 border border-border/60 flex flex-col gap-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-medium">
                          {lesson.className} · {lesson.groupName} · {lesson.subject}
                        </span>
                        <span className="text-muted-foreground">
                          {lesson.hours} {t('rozImport.hoursSuffix')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-muted-foreground">
                        <span>{lesson.teacher}</span>
                        {lesson.slots.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {lesson.slots.map((slot, sIdx) => (
                              <Badge key={sIdx} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {slot}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger notice */}
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('rozImport.dangerNotice')}</span>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" onClick={handleCancel} disabled={importing}>
            {t('rozImport.cancelButton')}
          </Button>
          <Button onClick={handleConfirm} disabled={importing} className="gap-2 gradient-primary">
            {importing ? t('common.importing') : t('rozImport.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
