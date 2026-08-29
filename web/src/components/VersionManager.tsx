import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, RotateCcw, Trash2, Clock, Plus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  saveVersionAction,
  restoreVersionAction,
  deleteVersionAction,
} from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

export function VersionManager() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const { activeWorkspace, versions } = useAppSelector((state) => state.workspace);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim() || !activeWorkspace) return;

    await dispatch(
      saveVersionAction({
        workspaceId: activeWorkspace.id,
        name: versionName.trim(),
      })
    ).unwrap();

    setVersionName('');
    setIsDialogOpen(false);
  };

  const handleRestore = async (versionId: string) => {
    if (!activeWorkspace) return;
    setRestoringId(versionId);
    try {
      await dispatch(
        restoreVersionAction({
          versionId,
          workspaceId: activeWorkspace.id,
        })
      ).unwrap();
      await reloadState();
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!activeWorkspace) return;
    await dispatch(
      deleteVersionAction({
        versionId,
        workspaceId: activeWorkspace.id,
      })
    ).unwrap();
  };

  if (!activeWorkspace) return null;

  return (
    <>
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-primary" />
              {t('versions.title', 'Збережені версії та контрольні точки')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t(
                'versions.desc',
                'Створюйте іменовані контрольні точки розкладу для швидкого відновлення до будь-якого етапу.'
              )}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" />
            {t('versions.create', 'Зберегти версію')}
          </Button>
        </CardHeader>

        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {t('versions.empty', 'Немає збережених версій для цього року')}
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-background/60 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {ver.name || (ver.type === 'auto' ? 'Автозбереження' : 'Контрольна точка')}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          ver.type === 'manual'
                            ? 'bg-primary/10 text-primary'
                            : ver.type === 'conflict'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ver.type === 'manual'
                          ? 'Ручна'
                          : ver.type === 'conflict'
                          ? 'Конфлікт'
                          : 'Авто'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(ver.createdAt).toLocaleString('uk-UA')}</span>
                      {ver.sizeBytes && (
                        <span>• {(ver.sizeBytes / 1024).toFixed(1)} КБ</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoringId === ver.id}
                      onClick={() => handleRestore(ver.id)}
                      className="text-xs h-8 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {restoringId === ver.id ? 'Відновлення...' : t('versions.restore', 'Відновити')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(ver.id)}
                      className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={t('common.delete', 'Видалити')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Named Version Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveVersion}>
            <DialogHeader>
              <DialogTitle>{t('versions.createTitle', 'Створити контрольну точку')}</DialogTitle>
              <DialogDescription>
                {t(
                  'versions.createDesc',
                  'Збережіть поточний стан розкладу з описом (наприклад: "До перерозподілу навантаження")'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="напр., Фінальний варіант I семестру"
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel', 'Скасувати')}
              </Button>
              <Button type="submit">{t('common.save', 'Зберегти')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
