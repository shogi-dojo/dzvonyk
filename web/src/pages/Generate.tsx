import React, { useState, useRef } from 'react';
import { Play, Pause, Square, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  startGeneration,
  pauseGeneration,
  resumeGeneration,
  stopGeneration,
  updateProgress,
  generationComplete,
  generationFailed,
  resetGeneration,
  addConflict,
} from '@/store/slices/generationSlice';
import { TimetableGenerator } from '@/lib/engine/generator';
import { formatElapsedTime } from '@/lib/engine/utils';
import { db } from '@/db';

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
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [generationResult, setGenerationResult] = useState<{
    placed: number;
    total: number;
    complete: boolean;
  } | null>(null);
  const generatorRef = useRef<TimetableGenerator | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    if (!rules) {
      alert('Please set up the timetable rules first in Settings.');
      return;
    }

    const activeActivities = activities.filter(a => a.active);
    if (activeActivities.length === 0) {
      alert('Please add some activities before generating the timetable.');
      return;
    }

    dispatch(startGeneration(activeActivities.length));
    dispatch(resetGeneration());
    setElapsedTime(0);
    setGenerationResult(null);
    startTimer();

    generatorRef.current = new TimetableGenerator(
      rules,
      activities,
      teachers,
      subgroups || [],
      rooms,
      timeConstraints,
      spaceConstraints
    );

    try {
      const result = await generatorRef.current.generate({
        onProgress: (placed, total) => {
          dispatch(updateProgress({ placedActivities: placed }));
        },
        shouldStop: () => generation.isPaused,
      });

      stopTimer();

      setGenerationResult({
        placed: result.placedActivities,
        total: result.totalActivities,
        complete: result.success,
      });

      // Add conflicts to state
      for (const conflict of result.conflicts) {
        dispatch(addConflict(conflict.reason));
      }

      if (result.success) {
        dispatch(generationComplete());
        
        // Save solution
        await db.solutions.add({
          id: crypto.randomUUID(),
          rulesId: rules.id,
          placements: result.timeAllocations.map(ta => ({
            activityId: activities[ta.activityIndex]?.id || '',
            day: ta.day,
            hour: ta.hour,
          })),
          conflicts: result.conflicts.map(c => c.reason),
          isComplete: true,
          generatedAt: new Date(),
        });
      } else {
        // Partial solution
        dispatch(generationFailed(
          `Placed ${result.placedActivities} of ${result.totalActivities} activities`
        ));
        
        // Still save partial solution
        if (result.placedActivities > 0) {
          await db.solutions.add({
            id: crypto.randomUUID(),
            rulesId: rules.id,
            placements: result.timeAllocations.map(ta => ({
              activityId: activities[ta.activityIndex]?.id || '',
              day: ta.day,
              hour: ta.hour,
            })),
            conflicts: result.conflicts.map(c => c.reason),
            isComplete: false,
            generatedAt: new Date(),
          });
        }
      }
    } catch (error) {
      stopTimer();
      console.error('Generation error:', error);
      dispatch(generationFailed(String(error)));
    }
  };

  const handlePause = () => {
    dispatch(pauseGeneration());
  };

  const handleResume = () => {
    dispatch(resumeGeneration());
  };

  const handleStop = () => {
    if (generatorRef.current) {
      generatorRef.current.stop();
    }
    stopTimer();
    dispatch(stopGeneration());
  };

  const handleReset = () => {
    stopTimer();
    setElapsedTime(0);
    setGenerationResult(null);
    dispatch(resetGeneration());
  };

  const progressPercentage = generation.totalActivities > 0
    ? Math.round((generation.placedActivities / generation.totalActivities) * 100)
    : 0;

  const getStatusBadge = () => {
    if (generation.isRunning) {
      return generation.isPaused 
        ? <Badge variant="secondary">Paused</Badge>
        : <Badge className="bg-blue-500">Running</Badge>;
    }
    if (generationResult) {
      if (generationResult.complete) {
        return <Badge className="bg-green-500">Complete</Badge>;
      }
      return <Badge className="bg-yellow-500">Partial ({generationResult.placed}/{generationResult.total})</Badge>;
    }
    return <Badge variant="outline">Ready</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Generate Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Generate an optimal timetable based on your constraints
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Pre-generation checks */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-Generation Check</CardTitle>
          <CardDescription>Verify your data before generating</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {rules ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Rules</p>
                <p className="text-sm text-gray-500">{rules ? `${rules.nDaysPerWeek} days × ${rules.nHoursPerDay} hours` : 'Not configured'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {activities.length > 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Activities</p>
                <p className="text-sm text-gray-500">{activities.filter(a => a.active).length} active</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {teachers.length > 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Teachers</p>
                <p className="text-sm text-gray-500">{teachers.length} defined</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {timeConstraints.length > 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Constraints</p>
                <p className="text-sm text-gray-500">{timeConstraints.length} time, {spaceConstraints.length} space</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generation Controls</CardTitle>
          <CardDescription>
            Start, pause, or stop the timetable generation process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            {!generation.isRunning ? (
              <Button onClick={handleStart} className="gap-2">
                <Play className="h-4 w-4" />
                Start Generation
              </Button>
            ) : generation.isPaused ? (
              <Button onClick={handleResume} className="gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={handlePause} variant="secondary" className="gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            
            {generation.isRunning && (
              <Button onClick={handleStop} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
            
            {!generation.isRunning && (generation.placedActivities > 0 || generationResult) && (
              <>
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
                <Button asChild variant="outline">
                  <Link to="/timetable">View Timetable</Link>
                </Button>
              </>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Progress</span>
              <span className="text-gray-700 dark:text-gray-300">{progressPercentage}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full transition-all duration-300 ${
                  generationResult?.complete 
                    ? 'bg-green-500' 
                    : generationResult 
                      ? 'bg-yellow-500' 
                      : 'bg-blue-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-gray-500 dark:text-gray-400">Activities Placed</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {generation.placedActivities} / {generation.totalActivities}
              </div>
            </div>
            
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-gray-500 dark:text-gray-400">Max Placed</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {generation.maxPlacedActivities}
              </div>
            </div>
            
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-gray-500 dark:text-gray-400">Elapsed Time</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>
            
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-gray-500 dark:text-gray-400">Issues</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {generation.conflicts.length}
              </div>
            </div>
          </div>

          {/* Result Summary */}
          {generationResult && (
            <div className={`rounded-lg border p-4 ${
              generationResult.complete 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
            }`}>
              <div className="flex items-center gap-2">
                {generationResult.complete 
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <AlertTriangle className="h-5 w-5 text-yellow-600" />
                }
                <span className={`font-medium ${
                  generationResult.complete ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {generationResult.complete 
                    ? 'Timetable generated successfully!' 
                    : `Partial solution: ${generationResult.placed} of ${generationResult.total} activities placed`
                  }
                </span>
              </div>
              {!generationResult.complete && (
                <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                  Some activities could not be placed due to constraint conflicts. 
                  Try relaxing some constraints or review the conflicts below.
                </p>
              )}
            </div>
          )}

          {/* Conflicts */}
          {generation.conflicts.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-900/20">
              <h3 className="mb-2 font-semibold text-red-700 dark:text-red-300">Issues ({generation.conflicts.length})</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400 max-h-48 overflow-y-auto">
                {generation.conflicts.slice(0, 20).map((conflict, i) => (
                  <li key={i}>{conflict}</li>
                ))}
                {generation.conflicts.length > 20 && (
                  <li className="font-medium">...and {generation.conflicts.length - 20} more</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Successful Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
            <li>Ensure you have the basic compulsory time and space constraints</li>
            <li>If generation fails, try reducing constraint weights from 100% to lower values</li>
            <li>Activities with more teachers/students are scheduled first (more constrained)</li>
            <li>Check that your time structure (days/hours) can accommodate all activities</li>
            <li>Partial solutions can still be viewed in the Timetable page</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
