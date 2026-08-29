import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Smartphone, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface InstallPwaButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showText?: boolean;
}

export function InstallPwaButton({
  variant = 'outline',
  size = 'sm',
  className,
  showText = true,
}: InstallPwaButtonProps) {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (!success) {
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={cn('gap-2 border-primary/40 text-foreground hover:bg-primary/10', className)}
        title="Встановити «Дзвоник» як додаток"
      >
        <Download className="h-4 w-4 text-primary animate-bounce shrink-0" />
        {showText && (
          <span className="font-medium">
            {t('pwa.install', { defaultValue: 'Встановити додаток' })}
          </span>
        )}
      </Button>

      {/* Manual Install Instructions Dialog for iOS / Safari / unsupported browsers */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <span>{t('pwa.dialogTitle', { defaultValue: 'Встановлення додатка «Дзвоник»' })}</span>
            </DialogTitle>
            <DialogDescription>
              {t('pwa.dialogDesc', {
                defaultValue:
                  '«Дзвоник» працює як повноцінний додаток без інтернету на компʼютері та телефоні.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-start gap-3">
              <Monitor className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">На компʼютері (Chrome / Edge / Safari):</strong>
                <span>Натисніть на значок <strong>«Встановити»</strong> в адресному рядку браузера праворуч або в меню браузера оберіть <em>«Встановити сторінку як додаток»</em>.</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">На телефоні (iPhone / Android):</strong>
                <span>В меню браузера (кнопка <strong>«Поділитися»</strong> на iOS або <strong>три крапки</strong> на Android) оберіть <em>«На екран "Додому"»</em> або <em>«Встановити додаток»</em>.</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
