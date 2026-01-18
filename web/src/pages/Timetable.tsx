import React, { useState, useMemo, useCallback } from 'react';
import { Download, Eye, Users, UserRound, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppSelector } from '@/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { cn } from '@/lib/utils';

type ViewType = 'teachers' | 'students' | 'rooms';

export function Timetable() {
  const rules = useAppSelector((state) => state.rules.current);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { rooms } = useAppSelector((state) => state.rooms);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  
  // State for lazy loading - user selects view first
  const [viewType, setViewType] = useState<ViewType | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [loading, setLoading] = useState(false);

  const solutions = useLiveQuery(() => db.solutions.toArray());
  const latestSolution = solutions?.[solutions.length - 1];

  // Build student hierarchy for selection
  const studentHierarchy = useMemo(() => {
    const hierarchy: { id: string; name: string; type: 'year' | 'group' | 'subgroup'; indent: number }[] = [];
    
    years.forEach(year => {
      hierarchy.push({ id: year.name, name: year.name, type: 'year', indent: 0 });
      
      const yearGroups = groups.filter(g => year.groups.includes(g.name));
      yearGroups.forEach(group => {
        hierarchy.push({ id: group.name, name: group.name, type: 'group', indent: 1 });
        
        const groupSubgroups = subgroups.filter(s => group.subgroups.includes(s.name));
        groupSubgroups.forEach(subgroup => {
          hierarchy.push({ id: subgroup.name, name: subgroup.name, type: 'subgroup', indent: 2 });
        });
      });
    });
    
    return hierarchy;
  }, [years, groups, subgroups]);

  // Build timetable grid data - only when showGrid is true
  const timetableData = useMemo(() => {
    if (!showGrid || !latestSolution || !rules || !selectedEntity) return null;

    const grid: (Array<{ subject: string; teachers: string; room?: string }> | null)[][] = Array.from(
      { length: rules.nHoursPerDay },
      () => Array(rules.nDaysPerWeek).fill(null)
    );

    for (const placement of latestSolution.placements) {
      const activity = activities.find(a => a.id === placement.activityId);
      if (!activity) continue;

      // Filter by selected entity
      let shouldInclude = false;
      
      if (viewType === 'teachers') {
        const teacher = teachers.find(t => t.id === selectedEntity || t.name === selectedEntity);
        if (teacher && activity.teacherIds.some(tid => tid === teacher.name || tid === teacher.id)) {
          shouldInclude = true;
        }
      } else if (viewType === 'students') {
        // Check if activity includes this student set (year, group, or subgroup)
        if (activity.studentSetIds.some(sid => sid === selectedEntity)) {
          shouldInclude = true;
        }
      } else if (viewType === 'rooms') {
        if (placement.roomId === selectedEntity) {
          shouldInclude = true;
        }
      }

      if (!shouldInclude) continue;

      const subject = subjects.find(s => s.id === activity.subjectId || s.name === activity.subjectId);
      const subjectName = subject?.name || activity.subjectId;
      const teacherNames = activity.teacherIds.join(', ');
      const room = rooms.find(r => r.id === placement.roomId);

      for (let h = 0; h < activity.duration; h++) {
        if (placement.hour + h < rules.nHoursPerDay) {
          const existing = grid[placement.hour + h][placement.day];
          const entry = { 
            subject: subjectName, 
            teachers: teacherNames,
            room: room?.name 
          };
          
          if (existing) {
            grid[placement.hour + h][placement.day] = [...existing, entry];
          } else {
            grid[placement.hour + h][placement.day] = [entry];
          }
        }
      }
    }

    return grid;
  }, [showGrid, latestSolution, rules, activities, teachers, subjects, rooms, viewType, selectedEntity]);

  const handleViewTimetable = useCallback(() => {
    if (!selectedEntity) return;
    setLoading(true);
    // Simulate loading delay for visual feedback
    setTimeout(() => {
      setShowGrid(true);
      setLoading(false);
    }, 300);
  }, [selectedEntity]);

  const handleChangeSelection = () => {
    setShowGrid(false);
    setSelectedEntity(null);
  };

  const handleExport = () => {
    if (!rules || !timetableData) return;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Timetable - ${rules.institutionName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 10px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; min-width: 100px; }
          th { background-color: #3b82f6; color: white; }
          .activity { background-color: #e0f2fe; }
          .subject { font-weight: bold; color: #1e40af; }
          .teacher { font-size: 0.85em; color: #666; }
          .room { font-size: 0.8em; color: #888; }
        </style>
      </head>
      <body>
        <h1>${rules.institutionName}</h1>
        <h2>${viewType === 'teachers' ? 'Teacher' : viewType === 'students' ? 'Student' : 'Room'}: ${selectedEntity}</h2>
        <table>
          <thead>
            <tr>
              <th>Hour</th>
              ${rules.daysOfTheWeek.map(d => `<th>${d.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    for (let hour = 0; hour < rules.nHoursPerDay; hour++) {
      html += `<tr><td><strong>${rules.hoursOfTheDay[hour]?.name || hour}</strong></td>`;
      for (let day = 0; day < rules.nDaysPerWeek; day++) {
        const cells = timetableData[hour][day];
        if (cells && cells.length > 0) {
          const content = cells.map(c => 
            `<div class="subject">${c.subject}</div><div class="teacher">${c.teachers}</div>${c.room ? `<div class="room">${c.room}</div>` : ''}`
          ).join('<hr style="margin: 4px 0; border: none; border-top: 1px dashed #ccc;">');
          html += `<td class="activity">${content}</td>`;
        } else {
          html += '<td></td>';
        }
      }
      html += '</tr>';
    }

    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable-${selectedEntity?.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!rules) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400">View and export your generated timetable</p>
        </div>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
            Please set up your timetable rules first in Settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!latestSolution) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400">View and export your generated timetable</p>
        </div>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
            No timetable has been generated yet. Go to the Generate page to create one.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400">View and export your generated timetable</p>
        </div>
        {showGrid && (
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export HTML
          </Button>
        )}
      </div>

      {/* View Selection - Show first before loading data */}
      {!showGrid && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* View Type Selection */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">1. Select View Type</CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Choose what type of timetable to view
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={viewType === 'teachers' ? 'default' : 'outline'}
                className="w-full justify-start gap-2"
                onClick={() => { setViewType('teachers'); setSelectedEntity(null); }}
              >
                <UserRound className="h-4 w-4" />
                By Teacher ({teachers.length})
              </Button>
              <Button
                variant={viewType === 'students' ? 'default' : 'outline'}
                className="w-full justify-start gap-2"
                onClick={() => { setViewType('students'); setSelectedEntity(null); }}
              >
                <Users className="h-4 w-4" />
                By Students ({years.length + groups.length + subgroups.length})
              </Button>
              <Button
                variant={viewType === 'rooms' ? 'default' : 'outline'}
                className="w-full justify-start gap-2"
                onClick={() => { setViewType('rooms'); setSelectedEntity(null); }}
              >
                <Building2 className="h-4 w-4" />
                By Room ({rooms.length})
              </Button>
            </CardContent>
          </Card>

          {/* Entity Selection */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">2. Select {viewType === 'teachers' ? 'Teacher' : viewType === 'students' ? 'Student Group' : 'Room'}</CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                {viewType ? `Choose a specific ${viewType === 'teachers' ? 'teacher' : viewType === 'students' ? 'student group' : 'room'}` : 'First select a view type'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!viewType ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                  Select a view type first
                </p>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-1">
                    {viewType === 'teachers' && teachers.map(t => (
                      <Button
                        key={t.id}
                        variant={selectedEntity === t.name ? 'default' : 'ghost'}
                        className="w-full justify-start text-left"
                        onClick={() => setSelectedEntity(t.name)}
                      >
                        {t.name}
                      </Button>
                    ))}
                    
                    {viewType === 'students' && studentHierarchy.map((item, idx) => (
                      <Button
                        key={idx}
                        variant={selectedEntity === item.id ? 'default' : 'ghost'}
                        className={cn(
                          "w-full justify-start text-left",
                          item.indent === 1 && "ml-4",
                          item.indent === 2 && "ml-8"
                        )}
                        onClick={() => setSelectedEntity(item.id)}
                      >
                        <span className={cn(
                          item.type === 'year' && "font-semibold",
                          item.type === 'subgroup' && "text-sm"
                        )}>
                          {item.type === 'year' && '📅 '}
                          {item.type === 'group' && '👥 '}
                          {item.type === 'subgroup' && '👤 '}
                          {item.name}
                        </span>
                      </Button>
                    ))}
                    
                    {viewType === 'rooms' && rooms.map(r => (
                      <Button
                        key={r.id}
                        variant={selectedEntity === r.name ? 'default' : 'ghost'}
                        className="w-full justify-start text-left"
                        onClick={() => setSelectedEntity(r.name)}
                      >
                        {r.name} {r.capacity ? `(${r.capacity})` : ''}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* View Button */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">3. View Timetable</CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Click to load and display the timetable
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {selectedEntity ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ready to view timetable for:
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedEntity}
                  </p>
                  <Button onClick={handleViewTimetable} disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        View Timetable
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a {viewType === 'teachers' ? 'teacher' : viewType === 'students' ? 'student group' : viewType === 'rooms' ? 'room' : 'view type'} to continue
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timetable Grid - Only shown after selection */}
      {showGrid && timetableData && (
        <>
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-gray-100">
                    {viewType === 'teachers' ? 'Teacher' : viewType === 'students' ? 'Student' : 'Room'}: {selectedEntity}
                  </CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Generated on {new Date(latestSolution.generatedAt).toLocaleString()}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={handleChangeSelection}>
                  Change Selection
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-2 font-semibold text-gray-900 dark:text-gray-100 min-w-[80px]">
                          Hour
                        </th>
                        {rules.daysOfTheWeek.map((day) => (
                          <th key={day.name} className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-2 font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">
                            {day.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.hoursOfTheDay.map((hour, hourIndex) => (
                        <tr key={hour.name}>
                          <td className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-2 font-medium text-gray-900 dark:text-gray-100">
                            {hour.name}
                          </td>
                          {rules.daysOfTheWeek.map((day, dayIndex) => {
                            const cells = timetableData?.[hourIndex]?.[dayIndex];
                            return (
                              <td
                                key={`${day.name}-${hour.name}`}
                                className={cn(
                                  "border border-gray-300 dark:border-gray-600 p-2 text-center text-sm align-top",
                                  cells && cells.length > 0
                                    ? "bg-blue-100 dark:bg-blue-900/30" 
                                    : "bg-white dark:bg-gray-800"
                                )}
                              >
                                {cells?.map((cell, i) => (
                                  <div key={i} className={cn(i > 0 && "mt-2 pt-2 border-t border-dashed border-gray-300 dark:border-gray-600")}>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{cell.subject}</div>
                                    <div className="text-gray-500 dark:text-gray-400 text-xs">{cell.teachers}</div>
                                    {cell.room && (
                                      <div className="text-gray-400 dark:text-gray-500 text-xs">{cell.room}</div>
                                    )}
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Solution Info */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Solution Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Generated At</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(latestSolution.generatedAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Activities Placed</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{latestSolution.placements.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                  <div className={cn(
                    "font-medium",
                    latestSolution.isComplete ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                  )}>
                    {latestSolution.isComplete ? 'Complete' : 'Partial'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Conflicts</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{latestSolution.conflicts.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
