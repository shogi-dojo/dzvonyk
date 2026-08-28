import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Square, RotateCcw, CheckCircle2, AlertTriangle, 
  XCircle, Clock, Eye, Zap, Activity, Target, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatCard } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  startGeneration, pauseGeneration, resumeGeneration, stopGeneration,
  updateProgress, generationComplete, generationFailed, resetGeneration, addConflict,
} from '@/store/slices/generationSlice';
import type { WorkerInMessage, WorkerOutMessage } from '@/lib/engine/generator.worker';
import type { GenerationResult } from '@/lib/engine/types';
import { runPreflight, type PreflightResult } from '@/lib/validation/preflight';
import { db } from '@/db';
import type { TimetableSolution } from '@/types';
import { cn } from '@/lib/utils';

export function Generate() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const generation = useAppSelector((state) => state.generation);
  const rules = useAppSelector((state) => state.rules.current);
  const activities = useAppSelector((state) => state.activities.items);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subgroups = useAppSelector((state) => state.students.subgroups);
  const studentsGroups = useAppSelector((state) => state.students.groups);
  const { rooms } = useAppSelector((state) => state.rooms);
  const timeConstraints = useAppSelector((state) => state.constraints.timeConstraints);
  const spaceConstraints = useAppSelector((state) => state.constraints.spaceConstraints);
  
  const [lastSolution, setLastSolution] = useState<TimetableSolution | null>(null);
  const [currentPlaced, setCurrentPlaced] = useState(0);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [generationTimestamp, setGenerationTimestamp] = useState<Date | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadLastSolution = async () => {
      try {
        const solutions = await db.solutions.orderBy('generatedAt').reverse().limit(1).toArray();
        if (solutions.length > 0) {
          const solution = solutions[0];
          setLastSolution(solution);
          setCurrentPlaced(solution.placements.length);
          setCurrentTotal(solution.placements.length);
          setGenerationTimestamp(new Date(solution.generatedAt));
        }
      } catch (error) {
        console.error('Error loading last solution:', error);
      }
    };
    loadLastSolution();
  }, []);

  useEffect(() => {
    if (!generation.isRunning && generation.placedActivities === 0 && generation.totalActivities === 0 && !lastSolution) {
      setCurrentPlaced(0);
      setCurrentTotal(0);
    }
  }, [generation.isRunning, generation.placedActivities, generation.totalActivities, lastSolution]);

  const finishGeneration = async (result: GenerationResult) => {
    if (!rules) return;
    const timestamp = new Date();
    setGenerationTimestamp(timestamp);
    setCurrentPlaced(result.placedActivities);
    setCurrentTotal(result.totalActivities);

    for (const conflict of result.conflicts) dispatch(addConflict(conflict.reason));

    const newSolution: TimetableSolution = {
      id: crypto.randomUUID(),
      rulesId: rules.id,
      placements: result.timeAllocations.map((ta) => ({
        activityId: activities[ta.activityIndex]?.id || '',
        day: ta.day,
        hour: ta.hour,
      })),
      conflicts: result.conflicts.map((c) => c.reason),
      isComplete: result.success,
      generatedAt: timestamp,
    };

    await db.solutions.add(newSolution);
    setLastSolution(newSolution);

    if (result.success) dispatch(generationComplete());
    else dispatch(generationFailed(`Placed ${result.placedActivities} of ${result.totalActivities} activities`));
  };

  const handleStart = async () => {
    if (!rules) { alert(t('generate.errors.needRules')); return; }
    const activeActivities = activities.filter((a) => a.active);
    if (activeActivities.length === 0) { alert(t('generate.errors.needActivities')); return; }

    const pf = runPreflight({
      rules, activities, teachers, rooms,
      studentsGroups, studentsSubgroups: subgroups || [],
      timeConstraints, spaceConstraints,
    });
    setPreflight(pf);
    if (!pf.ok) return;

    setCurrentPlaced(0);
    setCurrentTotal(activeActivities.length);
    setLastSolution(null);
    setGenerationTimestamp(null);
    dispatch(startGeneration(activeActivities.length));
    dispatch(resetGeneration());

    // Fresh worker per run — cheaper than clearing state and avoids leaked handlers.
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL('../lib/engine/generator.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          setCurrentPlaced(msg.placed);
          setCurrentTotal(msg.total);
          dispatch(updateProgress({ placedActivities: msg.placed }));
          break;
        case 'conflict':
          dispatch(addConflict(msg.conflict.reason));
          break;
        case 'done':
          finishGeneration(msg.result);
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          break;
        case 'error':
          console.error('Worker error:', msg.message);
          dispatch(generationFailed(msg.message));
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          break;
      }
    };

    worker.onerror = (event) => {
      console.error('Worker crashed:', event);
      dispatch(generationFailed(event.message ?? 'worker crashed'));
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };

    const startMsg: WorkerInMessage = {
      type: 'start',
      payload: {
        rules,
        activities,
        teachers,
        subgroups: subgroups || [],
        rooms,
        timeConstraints,
        spaceConstraints,
      },
    };
    worker.postMessage(startMsg);
  };

  const handlePause = () => dispatch(pauseGeneration());
  const handleResume = () => dispatch(resumeGeneration());
  const handleStop = () => {
    const stopMsg: WorkerInMessage = { type: 'stop' };
    workerRef.current?.postMessage(stopMsg);
    dispatch(stopGeneration());
  };
  const handleReset = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setCurrentPlaced(0);
    setCurrentTotal(0);
    setLastSolution(null);
    setGenerationTimestamp(null);
    setPreflight(null);
    dispatch(resetGeneration());
  };

  const activeActivitiesCount = activities.filter(a => a.active).length;
  const displayTotal = currentTotal || lastSolution?.placements.length || activeActivitiesCount;
  const displayPlaced = currentPlaced || lastSolution?.placements.length || 0;
  const progressPercentage = displayTotal > 0 ? Math.round((displayPlaced / displayTotal) * 100) : 0;

  const formatTimestamp = (date: Date) => date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const getStatusBadge = () => {
    if (generation.isRunning) {
      return generation.isPaused
        ? <Badge variant="secondary" className="animate-pulse">{t('generate.status.paused')}</Badge>
        : <Badge className="bg-primary animate-pulse">{t('generate.status.running')}</Badge>;
    }
    if (lastSolution) {
      return lastSolution.isComplete
        ? <Badge className="bg-success">{t('generate.status.complete')}</Badge>
        : <Badge className="bg-warning">{t('generate.status.partial')}</Badge>;
    }
    return <Badge variant="outline">{t('generate.status.ready')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('generate.title')}
        description={t('generate.description')}
        icon={<Zap className="h-6 w-6" />}
        actions={getStatusBadge()}
      />

      {/* Last Solution Card */}
      {lastSolution && !generation.isRunning && (
        <Card className={cn("animate-slide-up border-2", lastSolution.isComplete ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5")}>
          <CardContent className="py-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", lastSolution.isComplete ? "bg-success/20" : "bg-warning/20")}>
                  {lastSolution.isComplete ? <CheckCircle2 className="h-6 w-6 text-success" /> : <AlertTriangle className="h-6 w-6 text-warning" />}
                </div>
                <div>
                  <p className={cn("font-semibold text-lg", lastSolution.isComplete ? "text-success" : "text-warning")}>
                    {lastSolution.isComplete ? t('generate.lastSolution.success') : t('generate.lastSolution.partial')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('generate.lastSolution.placed', {
                      count: lastSolution.placements.length,
                      when: generationTimestamp ? formatTimestamp(generationTimestamp) : formatTimestamp(new Date(lastSolution.generatedAt)),
                    })}
                  </p>
                </div>
              </div>
              <Button asChild className="gap-2 bg-success hover:bg-success/90">
                <Link to="/timetable"><Eye className="h-4 w-4" />{t('generate.lastSolution.view')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preflight results */}
      {preflight && (preflight.blocking.length > 0 || preflight.warnings.length > 0) && (
        <Card className={cn("border-2 animate-slide-up", preflight.blocking.length > 0 ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", preflight.blocking.length > 0 ? "bg-destructive/20" : "bg-warning/20")}>
                {preflight.blocking.length > 0
                  ? <XCircle className="h-5 w-5 text-destructive" />
                  : <AlertTriangle className="h-5 w-5 text-warning" />}
              </div>
              <div>
                <CardTitle>
                  {preflight.blocking.length > 0
                    ? t('generate.preflight.blockedTitle')
                    : t('generate.preflight.warningsTitle')}
                </CardTitle>
                <CardDescription>
                  {preflight.blocking.length > 0
                    ? t('generate.preflight.blockedDesc')
                    : t('generate.preflight.warningsDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {preflight.blocking.length > 0 && (
              <ul className="space-y-2 text-sm">
                {preflight.blocking.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-destructive">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
            {preflight.warnings.length > 0 && (
              <ul className="space-y-2 text-sm">
                {preflight.warnings.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pre-generation Checks */}
      <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <div><CardTitle>{t('generate.precheck.title')}</CardTitle><CardDescription>{t('generate.precheck.description')}</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('generate.precheck.rules'), value: rules ? t('generate.precheck.rulesValue', { days: rules.nDaysPerWeek, hours: rules.nHoursPerDay }) : t('generate.precheck.rulesNotSet'), ok: !!rules, icon: Shield },
              { label: t('generate.precheck.activities'), value: t('generate.precheck.activitiesValue', { count: activeActivitiesCount }), ok: activeActivitiesCount > 0, icon: Activity },
              { label: t('generate.precheck.teachers'), value: t('generate.precheck.teachersValue', { count: teachers.length }), ok: teachers.length > 0, icon: Activity },
              { label: t('generate.precheck.constraints'), value: t('generate.precheck.constraintsValue', { count: timeConstraints.length + spaceConstraints.length }), ok: timeConstraints.length > 0, icon: Shield },
            ].map((check, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card transition-colors hover:bg-muted/50">
                {check.ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <div>
                  <p className="font-medium text-foreground">{check.label}</p>
                  <p className="text-sm text-muted-foreground">{check.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
            <div><CardTitle>{t('generate.controls.title')}</CardTitle><CardDescription>{t('generate.controls.description')}</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            {!generation.isRunning ? (
              <Button onClick={handleStart} className="gap-2 gradient-primary hover-lift">
                <Play className="h-4 w-4" />{lastSolution ? t('generate.controls.regenerate') : t('generate.controls.start')}
              </Button>
            ) : generation.isPaused ? (
              <Button onClick={handleResume} className="gap-2"><Play className="h-4 w-4" />{t('generate.controls.resume')}</Button>
            ) : (
              <Button onClick={handlePause} variant="secondary" className="gap-2"><Pause className="h-4 w-4" />{t('generate.controls.pause')}</Button>
            )}
            {generation.isRunning && (
              <Button onClick={handleStop} variant="destructive" className="gap-2"><Square className="h-4 w-4" />{t('generate.controls.stop')}</Button>
            )}
            {!generation.isRunning && lastSolution && (
              <Button onClick={handleReset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" />{t('generate.controls.reset')}</Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('generate.progress')}</span>
              <span className="font-medium text-foreground">{progressPercentage}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500 ease-out", lastSolution?.isComplete ? 'bg-success' : lastSolution ? 'bg-warning' : 'bg-primary')}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title={t('generate.stats.placed')} value={`${displayPlaced} / ${displayTotal}`} icon={<Activity className="h-5 w-5" />} />
            <StatCard title={t('generate.stats.maxPlaced')} value={Math.max(generation.maxPlacedActivities, lastSolution?.placements.length || 0)} icon={<Target className="h-5 w-5" />} />
            <StatCard title={t('generate.stats.issues')} value={generation.conflicts.length || lastSolution?.conflicts.length || 0} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          {/* Timestamp */}
          {(generationTimestamp || lastSolution) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{t('generate.lastRun', { when: formatTimestamp(generationTimestamp || new Date(lastSolution!.generatedAt)) })}</span>
            </div>
          )}

          {/* Conflicts */}
          {(generation.conflicts.length > 0 || (lastSolution?.conflicts.length || 0) > 0) && (
            <div className="rounded-xl border border-destructive/50 p-4 bg-destructive/5">
              <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />{t('generate.issues', { count: generation.conflicts.length || lastSolution?.conflicts.length || 0 })}
              </h4>
              <ul className="text-sm text-destructive/80 space-y-1 max-h-40 overflow-y-auto">
                {(generation.conflicts.length > 0 ? generation.conflicts : lastSolution?.conflicts || []).slice(0, 10).map((conflict, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-destructive">•</span>{conflict}</li>
                ))}
                {((generation.conflicts.length || lastSolution?.conflicts.length || 0) > 10) && (
                  <li className="font-medium">{t('generate.andMore')}</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <div><CardTitle>{t('generate.tips.title')}</CardTitle></div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5].map((n) => t(`generate.tips.${n}`)).map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />{tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
