import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Square, RotateCcw, CheckCircle2, AlertTriangle, 
  XCircle, Clock, Eye, Zap, Activity, Target, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatCard } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  startGeneration, pauseGeneration, resumeGeneration, stopGeneration,
  updateProgress, generationComplete, generationFailed, resetGeneration, addConflict,
} from '@/store/slices/generationSlice';
import { TimetableGenerator } from '@/lib/engine/generator';
import { db } from '@/db';
import type { TimetableSolution } from '@/types';
import { cn } from '@/lib/utils';

export function Generate() {
  const dispatch = useAppDispatch();
  const generation = useAppSelector((state) => state.generation);
  const rules = useAppSelector((state) => state.rules.current);
  const activities = useAppSelector((state) => state.activities.items);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subgroups = useAppSelector((state) => state.students.subgroups);
  const { rooms } = useAppSelector((state) => state.rooms);
  const timeConstraints = useAppSelector((state) => state.constraints.timeConstraints);
  const spaceConstraints = useAppSelector((state) => state.constraints.spaceConstraints);
  
  const [lastSolution, setLastSolution] = useState<TimetableSolution | null>(null);
  const [currentPlaced, setCurrentPlaced] = useState(0);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [generationTimestamp, setGenerationTimestamp] = useState<Date | null>(null);
  const generatorRef = useRef<TimetableGenerator | null>(null);
  const stopFlagRef = useRef<boolean>(false);

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

  const handleStart = async () => {
    if (!rules) { alert('Please set up the timetable rules first in Settings.'); return; }
    const activeActivities = activities.filter(a => a.active);
    if (activeActivities.length === 0) { alert('Please add some activities before generating.'); return; }

    stopFlagRef.current = false;
    setCurrentPlaced(0);
    setCurrentTotal(activeActivities.length);
    setLastSolution(null);
    setGenerationTimestamp(null);
    dispatch(startGeneration(activeActivities.length));
    dispatch(resetGeneration());

    generatorRef.current = new TimetableGenerator(rules, activities, teachers, subgroups || [], rooms, timeConstraints, spaceConstraints);

    try {
      const result = await generatorRef.current.generate({
        onProgress: (placed, total) => {
          setCurrentPlaced(placed);
          setCurrentTotal(total);
          dispatch(updateProgress({ placedActivities: placed }));
        },
        shouldStop: () => stopFlagRef.current,
      });

      const timestamp = new Date();
      setGenerationTimestamp(timestamp);
      setCurrentPlaced(result.placedActivities);
      setCurrentTotal(result.totalActivities);

      for (const conflict of result.conflicts) dispatch(addConflict(conflict.reason));

      const newSolution: TimetableSolution = {
        id: crypto.randomUUID(),
        rulesId: rules.id,
        placements: result.timeAllocations.map(ta => ({
          activityId: activities[ta.activityIndex]?.id || '', day: ta.day, hour: ta.hour,
        })),
        conflicts: result.conflicts.map(c => c.reason),
        isComplete: result.success,
        generatedAt: timestamp,
      };

      await db.solutions.add(newSolution);
      setLastSolution(newSolution);

      if (result.success) dispatch(generationComplete());
      else dispatch(generationFailed(`Placed ${result.placedActivities} of ${result.totalActivities} activities`));
    } catch (error) {
      console.error('Generation error:', error);
      dispatch(generationFailed(String(error)));
    }
  };

  const handlePause = () => dispatch(pauseGeneration());
  const handleResume = () => dispatch(resumeGeneration());
  const handleStop = () => { stopFlagRef.current = true; generatorRef.current?.stop(); dispatch(stopGeneration()); };
  const handleReset = () => { stopFlagRef.current = true; setCurrentPlaced(0); setCurrentTotal(0); setLastSolution(null); setGenerationTimestamp(null); dispatch(resetGeneration()); };

  const activeActivitiesCount = activities.filter(a => a.active).length;
  const displayTotal = currentTotal || lastSolution?.placements.length || activeActivitiesCount;
  const displayPlaced = currentPlaced || lastSolution?.placements.length || 0;
  const progressPercentage = displayTotal > 0 ? Math.round((displayPlaced / displayTotal) * 100) : 0;

  const formatTimestamp = (date: Date) => date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const getStatusBadge = () => {
    if (generation.isRunning) {
      return generation.isPaused 
        ? <Badge variant="secondary" className="animate-pulse">Paused</Badge>
        : <Badge className="bg-primary animate-pulse">Running</Badge>;
    }
    if (lastSolution) {
      return lastSolution.isComplete 
        ? <Badge className="bg-success">Complete</Badge>
        : <Badge className="bg-warning">Partial</Badge>;
    }
    return <Badge variant="outline">Ready</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate Timetable"
        description="Create an optimal schedule based on your constraints"
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
                    {lastSolution.isComplete ? 'Timetable Generated Successfully' : 'Partial Timetable Generated'}
                  </p>
                  <p className="text-muted-foreground">
                    {lastSolution.placements.length} activities placed • {generationTimestamp ? formatTimestamp(generationTimestamp) : formatTimestamp(new Date(lastSolution.generatedAt))}
                  </p>
                </div>
              </div>
              <Button asChild className="gap-2 bg-success hover:bg-success/90">
                <Link to="/timetable"><Eye className="h-4 w-4" />View Timetable</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-generation Checks */}
      <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <div><CardTitle>Pre-Generation Check</CardTitle><CardDescription>Verify your data before generating</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Rules', value: rules ? `${rules.nDaysPerWeek}d × ${rules.nHoursPerDay}h` : 'Not set', ok: !!rules, icon: Shield },
              { label: 'Activities', value: `${activeActivitiesCount} active`, ok: activeActivitiesCount > 0, icon: Activity },
              { label: 'Teachers', value: `${teachers.length} defined`, ok: teachers.length > 0, icon: Activity },
              { label: 'Constraints', value: `${timeConstraints.length + spaceConstraints.length} total`, ok: timeConstraints.length > 0, icon: Shield },
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
            <div><CardTitle>Generation Controls</CardTitle><CardDescription>Start, pause, or stop the generation process</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            {!generation.isRunning ? (
              <Button onClick={handleStart} className="gap-2 gradient-primary hover-lift">
                <Play className="h-4 w-4" />{lastSolution ? 'Regenerate' : 'Start Generation'}
              </Button>
            ) : generation.isPaused ? (
              <Button onClick={handleResume} className="gap-2"><Play className="h-4 w-4" />Resume</Button>
            ) : (
              <Button onClick={handlePause} variant="secondary" className="gap-2"><Pause className="h-4 w-4" />Pause</Button>
            )}
            {generation.isRunning && (
              <Button onClick={handleStop} variant="destructive" className="gap-2"><Square className="h-4 w-4" />Stop</Button>
            )}
            {!generation.isRunning && lastSolution && (
              <Button onClick={handleReset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" />Reset</Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
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
            <StatCard title="Activities Placed" value={`${displayPlaced} / ${displayTotal}`} icon={<Activity className="h-5 w-5" />} />
            <StatCard title="Max Placed" value={Math.max(generation.maxPlacedActivities, lastSolution?.placements.length || 0)} icon={<Target className="h-5 w-5" />} />
            <StatCard title="Issues" value={generation.conflicts.length || lastSolution?.conflicts.length || 0} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          {/* Timestamp */}
          {(generationTimestamp || lastSolution) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last generation: {formatTimestamp(generationTimestamp || new Date(lastSolution!.generatedAt))}</span>
            </div>
          )}

          {/* Conflicts */}
          {(generation.conflicts.length > 0 || (lastSolution?.conflicts.length || 0) > 0) && (
            <div className="rounded-xl border border-destructive/50 p-4 bg-destructive/5">
              <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />Issues ({generation.conflicts.length || lastSolution?.conflicts.length || 0})
              </h4>
              <ul className="text-sm text-destructive/80 space-y-1 max-h-40 overflow-y-auto">
                {(generation.conflicts.length > 0 ? generation.conflicts : lastSolution?.conflicts || []).slice(0, 10).map((conflict, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-destructive">•</span>{conflict}</li>
                ))}
                {((generation.conflicts.length || lastSolution?.conflicts.length || 0) > 10) && (
                  <li className="font-medium">...and more</li>
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
            <div><CardTitle>Tips for Success</CardTitle></div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {[
              'Ensure you have basic compulsory time and space constraints',
              'If generation fails, try reducing constraint weights below 100%',
              'Activities with more teachers/students are scheduled first',
              'Check that your time structure can accommodate all activities',
              'Partial solutions can still be viewed in the Timetable page',
            ].map((tip, i) => (
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
