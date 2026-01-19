import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Download, Eye, UserCircle, Building2, Loader2, 
  Calendar, Clock, AlertTriangle, Grid3X3, CheckCircle2,
  GraduationCap, Users, RotateCcw, Printer, Archive, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatCard, EmptyState } from '@/components/PageTransition';
import { useAppSelector } from '@/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

type ViewType = 'teachers' | 'students' | 'rooms';

interface StudentHierarchyItem {
  id: string;
  displayName: string;
  type: 'year' | 'group' | 'subgroup';
  yearName?: string;
  groupName?: string;
}

interface CellData {
  subject: string;
  teachers: string[];
  students: string[];
  room?: string;
  duration: number;
  activityTags: string[];
  activityId: string;
  isSpan?: boolean;
}

interface BulkExportProgress {
  current: number;
  total: number;
  currentItem: string;
}

export function Timetable() {
  const rules = useAppSelector((state) => state.rules.current);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { rooms } = useAppSelector((state) => state.rooms);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  
  const [viewType, setViewType] = useState<ViewType | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkExportProgress | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const solutions = useLiveQuery(() => db.solutions.toArray());
  const latestSolution = solutions?.[solutions.length - 1];

  const studentHierarchy = useMemo(() => {
    const hierarchy: StudentHierarchyItem[] = [];
    
    years.forEach(year => {
      hierarchy.push({ id: year.name, displayName: year.name, type: 'year', yearName: year.name });
      
      const yearGroups = groups.filter(g => year.groups.includes(g.name));
      yearGroups.forEach(group => {
        hierarchy.push({ 
          id: group.name, displayName: `${year.name} / ${group.name}`, 
          type: 'group', yearName: year.name, groupName: group.name
        });
        
        const groupSubgroups = subgroups.filter(s => group.subgroups.includes(s.name));
        groupSubgroups.forEach(subgroup => {
          hierarchy.push({ 
            id: subgroup.name, displayName: `${year.name} / ${group.name} / ${subgroup.name}`, 
            type: 'subgroup', yearName: year.name, groupName: group.name
          });
        });
      });
    });
    
    return hierarchy;
  }, [years, groups, subgroups]);

  // Build timetable grid for a specific entity
  const buildTimetableGrid = useCallback((
    entityId: string,
    entityType: ViewType
  ): (CellData | null | 'spanned')[][] | null => {
    if (!latestSolution || !rules) return null;

    const grid: (CellData | null | 'spanned')[][] = Array.from(
      { length: rules.nHoursPerDay },
      () => Array(rules.nDaysPerWeek).fill(null)
    );

    for (const placement of latestSolution.placements) {
      const activity = activities.find(a => a.id === placement.activityId);
      if (!activity) continue;

      let shouldInclude = false;
      
      if (entityType === 'teachers') {
        const teacher = teachers.find(t => t.id === entityId || t.name === entityId);
        if (teacher && activity.teacherIds.some(tid => tid === teacher.name || tid === teacher.id)) {
          shouldInclude = true;
        }
      } else if (entityType === 'students') {
        if (activity.studentSetIds.some(sid => sid === entityId)) {
          shouldInclude = true;
        }
      } else if (entityType === 'rooms') {
        const room = rooms.find(r => r.id === entityId || r.name === entityId);
        if (room && (placement.roomId === room.id || placement.roomId === room.name)) {
          shouldInclude = true;
        }
      }

      if (!shouldInclude) continue;

      const subject = subjects.find(s => s.id === activity.subjectId || s.name === activity.subjectId);
      const subjectName = subject?.name || activity.subjectId;
      const room = rooms.find(r => r.id === placement.roomId || r.name === placement.roomId);

      const entry: CellData = { 
        subject: subjectName, 
        teachers: activity.teacherIds, 
        students: activity.studentSetIds,
        room: room?.name, 
        duration: activity.duration, 
        activityTags: activity.activityTagIds || [],
        activityId: activity.id,
      };

      if (placement.hour < rules.nHoursPerDay && placement.day < rules.nDaysPerWeek) {
        grid[placement.hour][placement.day] = entry;
        
        for (let h = 1; h < activity.duration; h++) {
          const spanHour = placement.hour + h;
          if (spanHour < rules.nHoursPerDay) {
            grid[spanHour][placement.day] = 'spanned';
          }
        }
      }
    }

    return grid;
  }, [latestSolution, rules, activities, teachers, subjects, rooms]);

  // Current view's timetable data
  const timetableData = useMemo(() => {
    if (!showGrid || !selectedEntity || !viewType) return null;
    return buildTimetableGrid(selectedEntity, viewType);
  }, [showGrid, selectedEntity, viewType, buildTimetableGrid]);

  const statistics = useMemo(() => {
    if (!timetableData || !rules) return null;

    let totalPeriods = 0;
    let totalGaps = 0;
    const periodsPerDay: number[] = Array(rules.nDaysPerWeek).fill(0);

    for (let day = 0; day < rules.nDaysPerWeek; day++) {
      let firstPeriod = -1;
      let lastPeriod = -1;
      let periodsInDay = 0;

      for (let hour = 0; hour < rules.nHoursPerDay; hour++) {
        const cell = timetableData[hour][day];
        if (cell && cell !== 'spanned') {
          periodsInDay += cell.duration;
          if (firstPeriod === -1) firstPeriod = hour;
          lastPeriod = hour + cell.duration - 1;
        }
      }

      periodsPerDay[day] = periodsInDay;
      totalPeriods += periodsInDay;

      if (firstPeriod !== -1 && lastPeriod !== -1) {
        for (let hour = firstPeriod; hour <= lastPeriod; hour++) {
          const cell = timetableData[hour][day];
          if (!cell) totalGaps++;
        }
      }
    }

    return { totalPeriods, totalGaps, periodsPerDay, averagePerDay: totalPeriods / rules.nDaysPerWeek };
  }, [timetableData, rules]);

  const getDisplayName = useCallback((entityId: string, entityType: ViewType) => {
    if (entityType === 'students') {
      const item = studentHierarchy.find(s => s.id === entityId);
      return item?.displayName || entityId;
    }
    if (entityType === 'teachers') {
      const teacher = teachers.find(t => t.name === entityId || t.id === entityId);
      return teacher?.name || entityId;
    }
    if (entityType === 'rooms') {
      const room = rooms.find(r => r.name === entityId || r.id === entityId);
      return room?.name || entityId;
    }
    return entityId;
  }, [studentHierarchy, teachers, rooms]);

  const getSelectedDisplayName = useCallback(() => {
    if (!selectedEntity || !viewType) return '';
    return getDisplayName(selectedEntity, viewType);
  }, [selectedEntity, viewType, getDisplayName]);

  const handleViewTimetable = useCallback(() => {
    if (!selectedEntity) return;
    setLoading(true);
    setTimeout(() => { setShowGrid(true); setLoading(false); }, 300);
  }, [selectedEntity]);

  const handleChangeSelection = () => { 
    setShowGrid(false); 
    setSelectedEntity(null); 
  };

  // Generate HTML for a single timetable
  const generateTimetableHtml = useCallback((
    entityId: string,
    entityType: ViewType,
    grid: (CellData | null | 'spanned')[][]
  ): string => {
    if (!rules) return '';
    
    const displayName = getDisplayName(entityId, entityType);
    const viewLabel = entityType === 'teachers' ? 'Teacher' : entityType === 'students' ? 'Students' : 'Room';
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timetable - ${displayName}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      padding: 24px; 
      background: #100e0a; 
      color: #e8e4dc;
      line-height: 1.6;
    }
    h1 { color: #e5a70a; margin-bottom: 4px; font-size: 28px; }
    h2 { color: #8a8578; margin-top: 0; font-weight: normal; font-size: 18px; }
    .meta { font-size: 12px; color: #6a6560; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { 
      border: 1px solid #332e26; 
      padding: 12px; 
      text-align: center; 
      min-width: 120px; 
      vertical-align: top; 
    }
    th { background: #1a1814; color: #e5a70a; font-weight: 600; }
    .time-header { background: #161410; }
    .activity { background: #1a1814; text-align: left; }
    .subject { font-weight: 600; color: #e5a70a; font-size: 14px; }
    .detail { font-size: 12px; color: #a8a090; margin-top: 4px; }
    .detail-light { font-size: 11px; color: #787060; margin-top: 3px; }
    .tags { font-size: 11px; color: #c9a020; margin-top: 4px; }
    .stats { 
      margin-top: 24px; 
      padding: 16px; 
      background: #1a1814; 
      border-radius: 8px;
      border: 1px solid #332e26;
      font-size: 14px;
    }
    @media print {
      body { background: white; color: black; padding: 10px; }
      th { background: #f5f0e0; color: #8a6000; }
      .activity { background: #fffbf0; }
      .subject { color: #8a6000; }
      .detail, .detail-light { color: #555; }
      .tags { color: #a08000; }
      .stats { background: #f8f4e8; border-color: #ddd; }
    }
  </style>
</head>
<body>
  <h1>${rules.institutionName}</h1>
  <h2>${viewLabel}: ${displayName}</h2>
  <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  <table>
    <thead>
      <tr>
        <th class="time-header">Time</th>
        ${rules.daysOfTheWeek.map(d => `<th>${d.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

    for (let hour = 0; hour < rules.nHoursPerDay; hour++) {
      html += `<tr><td class="time-header"><strong>${rules.hoursOfTheDay[hour]?.name || `Hour ${hour + 1}`}</strong></td>`;
      
      for (let day = 0; day < rules.nDaysPerWeek; day++) {
        const cell = grid[hour][day];
        
        if (cell === 'spanned') {
          continue;
        } else if (cell) {
          const rowspan = cell.duration > 1 ? ` rowspan="${cell.duration}"` : '';
          let content = `<div class="subject">${cell.subject}</div>`;
          
          if (entityType !== 'teachers' && cell.teachers.length > 0) {
            content += `<div class="detail">${cell.teachers.join(', ')}</div>`;
          }
          if (entityType !== 'students' && cell.students.length > 0) {
            content += `<div class="detail-light">${cell.students.join(', ')}</div>`;
          }
          if (cell.room) {
            content += `<div class="detail-light">${cell.room}</div>`;
          }
          if (cell.activityTags.length > 0) {
            content += `<div class="tags">${cell.activityTags.join(', ')}</div>`;
          }
          if (cell.duration > 1) {
            content += `<div class="detail-light">${cell.duration}h</div>`;
          }
          
          html += `<td class="activity"${rowspan}>${content}</td>`;
        } else {
          html += '<td></td>';
        }
      }
      html += '</tr>';
    }
    
    html += `</tbody></table>
</body>
</html>`;

    return html;
  }, [rules, getDisplayName]);

  // Print functionality
  const handlePrint = useCallback(() => {
    if (!rules || !timetableData || !selectedEntity || !viewType) return;
    
    const html = generateTimetableHtml(selectedEntity, viewType, timetableData);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }, [rules, timetableData, selectedEntity, viewType, generateTimetableHtml]);

  // Export single HTML file
  const handleExport = useCallback(() => {
    if (!rules || !timetableData || !selectedEntity || !viewType) return;
    
    const html = generateTimetableHtml(selectedEntity, viewType, timetableData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable-${selectedEntity.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rules, timetableData, selectedEntity, viewType, generateTimetableHtml]);

  // Bulk export all timetables as ZIP
  const handleBulkExport = useCallback(async () => {
    if (!rules || !latestSolution) return;
    
    setBulkExporting(true);
    const zip = new JSZip();
    
    // Collect all entities
    const allEntities: { id: string; type: ViewType; name: string }[] = [];
    
    teachers.forEach(t => {
      allEntities.push({ id: t.name, type: 'teachers', name: `teachers/${t.name.replace(/[/\\?%*:|"<>]/g, '-')}` });
    });
    
    studentHierarchy.forEach(s => {
      allEntities.push({ id: s.id, type: 'students', name: `students/${s.displayName.replace(/[/\\?%*:|"<>]/g, '-')}` });
    });
    
    rooms.forEach(r => {
      allEntities.push({ id: r.name, type: 'rooms', name: `rooms/${r.name.replace(/[/\\?%*:|"<>]/g, '-')}` });
    });
    
    const total = allEntities.length;
    
    // Generate timetable for each entity
    for (let i = 0; i < allEntities.length; i++) {
      const entity = allEntities[i];
      setBulkProgress({ current: i + 1, total, currentItem: entity.name });
      
      const grid = buildTimetableGrid(entity.id, entity.type);
      if (grid) {
        const html = generateTimetableHtml(entity.id, entity.type, grid);
        zip.file(`${entity.name}.html`, html);
      }
      
      // Yield to UI for progress update
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Generate index file
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Timetables - ${rules.institutionName}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: system-ui, sans-serif; 
      padding: 32px; 
      background: #100e0a; 
      color: #e8e4dc;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { color: #e5a70a; margin-bottom: 8px; }
    h2 { color: #c9a020; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #332e26; padding-bottom: 8px; }
    .meta { color: #8a8578; margin-bottom: 24px; }
    ul { list-style: none; padding: 0; }
    li { margin: 8px 0; }
    a { 
      color: #e5a70a; 
      text-decoration: none; 
      padding: 8px 12px;
      display: inline-block;
      border-radius: 4px;
      transition: background 0.2s;
    }
    a:hover { background: #1a1814; }
    .count { color: #6a6560; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${rules.institutionName}</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} • ${total} timetables</div>
  
  <h2>Teachers <span class="count">(${teachers.length})</span></h2>
  <ul>
    ${teachers.map(t => `<li><a href="teachers/${t.name.replace(/[/\\?%*:|"<>]/g, '-')}.html">${t.name}</a></li>`).join('\n    ')}
  </ul>
  
  <h2>Students <span class="count">(${studentHierarchy.length})</span></h2>
  <ul>
    ${studentHierarchy.map(s => `<li><a href="students/${s.displayName.replace(/[/\\?%*:|"<>]/g, '-')}.html">${s.displayName}</a></li>`).join('\n    ')}
  </ul>
  
  <h2>Rooms <span class="count">(${rooms.length})</span></h2>
  <ul>
    ${rooms.map(r => `<li><a href="rooms/${r.name.replace(/[/\\?%*:|"<>]/g, '-')}.html">${r.name}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>`;
    
    zip.file('index.html', indexHtml);
    
    // Generate ZIP and download
    setBulkProgress({ current: total, total, currentItem: 'Creating ZIP file...' });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetables-${rules.institutionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    setBulkExporting(false);
    setBulkProgress(null);
  }, [rules, latestSolution, teachers, studentHierarchy, rooms, buildTimetableGrid, generateTimetableHtml]);

  if (!rules) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Timetable" 
          description="View and export your generated timetable" 
          icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />} 
        />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Grid3X3 className="h-12 w-12" aria-hidden="true" />}
              title="No Rules Configured"
              description="Set up your timetable rules first to view schedules"
              action={<Button asChild><Link to="/settings">Go to Settings</Link></Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!latestSolution) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Timetable" 
          description="View and export your generated timetable" 
          icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />} 
        />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Calendar className="h-12 w-12" aria-hidden="true" />}
              title="No Timetable Generated"
              description="Generate a timetable first to view it here"
              action={<Button asChild><Link to="/generate">Generate Timetable</Link></Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description={`${rules.institutionName} • ${rules.nDaysPerWeek} days × ${rules.nHoursPerDay} hours`}
        icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />}
        actions={
          <div className="flex gap-2">
            {showGrid && (
              <>
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print
                </Button>
                <Button onClick={handleExport} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </Button>
              </>
            )}
            <Button onClick={handleBulkExport} disabled={bulkExporting} className="gap-2">
              {bulkExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Exporting...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Export All (ZIP)
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Bulk Export Progress Modal */}
      {bulkExporting && bulkProgress && (
        <Card className="animate-scale-in border-primary/50">
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">Exporting All Timetables</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="progress-bar" role="progressbar" aria-valuenow={bulkProgress.current} aria-valuemin={0} aria-valuemax={bulkProgress.total}>
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              
              <p className="text-sm text-muted-foreground truncate">
                {bulkProgress.currentItem}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Solution Summary */}
      <Card className={cn("animate-slide-up", latestSolution.isComplete ? "border-accent/50" : "border-warning/50")}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {latestSolution.isComplete ? (
                <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
              )}
              <div>
                <p className={cn("font-medium", latestSolution.isComplete ? "text-accent" : "text-warning")}>
                  {latestSolution.isComplete ? 'Complete Timetable' : 'Partial Timetable'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {latestSolution.placements.length} activities • {new Date(latestSolution.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            {!latestSolution.isComplete && (
              <Button asChild variant="outline" size="sm">
                <Link to="/generate">Regenerate</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!showGrid && (
        <div className="grid gap-6 lg:grid-cols-3 stagger-children">
          {/* Step 1: Select View Type */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">1. Select View Type</CardTitle>
              <CardDescription>Choose how to view the timetable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { type: 'teachers' as ViewType, icon: UserCircle, label: 'By Teacher', count: teachers.length },
                { type: 'students' as ViewType, icon: GraduationCap, label: 'By Students', count: studentHierarchy.length },
                { type: 'rooms' as ViewType, icon: Building2, label: 'By Room', count: rooms.length },
              ].map(opt => (
                <Button
                  key={opt.type}
                  variant={viewType === opt.type ? 'default' : 'outline'}
                  className="w-full justify-start gap-3"
                  onClick={() => { setViewType(opt.type); setSelectedEntity(null); }}
                  aria-pressed={viewType === opt.type}
                >
                  <opt.icon className="h-4 w-4" aria-hidden="true" />
                  {opt.label}
                  <Badge variant="secondary" className="ml-auto">{opt.count}</Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Step 2: Select Entity */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">
                2. Select {viewType === 'teachers' ? 'Teacher' : viewType === 'students' ? 'Group' : viewType === 'rooms' ? 'Room' : '...'}
              </CardTitle>
              <CardDescription>{viewType ? 'Choose from the list' : 'Select view type first'}</CardDescription>
            </CardHeader>
            <CardContent>
              {!viewType ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Select a view type first</p>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-1" role="listbox" aria-label={`Select ${viewType}`}>
                    {viewType === 'teachers' && teachers.map(t => (
                      <Button 
                        key={t.id} 
                        variant={selectedEntity === t.name ? 'default' : 'ghost'} 
                        className="w-full justify-start" 
                        onClick={() => setSelectedEntity(t.name)}
                        role="option"
                        aria-selected={selectedEntity === t.name}
                      >
                        <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                        {t.name}
                      </Button>
                    ))}
                    {viewType === 'students' && studentHierarchy.map((item, idx) => (
                      <Button
                        key={idx}
                        variant={selectedEntity === item.id ? 'default' : 'ghost'}
                        className={cn(
                          "w-full justify-start text-sm",
                          item.type === 'group' && "ml-4",
                          item.type === 'subgroup' && "ml-8"
                        )}
                        onClick={() => setSelectedEntity(item.id)}
                        role="option"
                        aria-selected={selectedEntity === item.id}
                      >
                        {item.type === 'year' && <Calendar className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                        {item.type === 'group' && <Users className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                        {item.type === 'subgroup' && <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                        {item.displayName}
                      </Button>
                    ))}
                    {viewType === 'rooms' && rooms.map(r => (
                      <Button 
                        key={r.id} 
                        variant={selectedEntity === r.name ? 'default' : 'ghost'} 
                        className="w-full justify-start" 
                        onClick={() => setSelectedEntity(r.name)}
                        role="option"
                        aria-selected={selectedEntity === r.name}
                      >
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                        {r.name}
                        {r.capacity && <span className="text-muted-foreground ml-2">({r.capacity})</span>}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Step 3: View Button */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">3. View Timetable</CardTitle>
              <CardDescription>Load and display the schedule</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {selectedEntity ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">Ready to view:</p>
                  <p className="font-semibold text-foreground">{getSelectedDisplayName()}</p>
                  <Button onClick={handleViewTimetable} disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View Timetable
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select an item to continue</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showGrid && timetableData && (
        <>
          <Card className="animate-slide-up" ref={printRef}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {viewType === 'teachers' && <UserCircle className="h-5 w-5 text-primary" aria-hidden="true" />}
                  {viewType === 'students' && <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />}
                  {viewType === 'rooms' && <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />}
                  <div>
                    <CardTitle>{getSelectedDisplayName()}</CardTitle>
                    <CardDescription>
                      {viewType === 'teachers' ? 'Teacher' : viewType === 'students' ? 'Student' : 'Room'} Schedule
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" onClick={handleChangeSelection} className="gap-2">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Change
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4">
                  <table className="w-full border-collapse timetable-grid" role="grid" aria-label="Timetable">
                    <thead>
                      <tr>
                        <th 
                          className="border border-border bg-muted p-3 font-semibold text-foreground min-w-[80px] sticky left-0 z-10"
                          scope="col"
                        >
                          Time
                        </th>
                        {rules.daysOfTheWeek.map((day) => (
                          <th 
                            key={day.name} 
                            className="border border-border bg-muted p-3 font-semibold text-foreground min-w-[140px]"
                            scope="col"
                          >
                            {day.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.hoursOfTheDay.map((hour, hourIndex) => (
                        <tr key={hour.name}>
                          <th 
                            className="border border-border bg-muted/50 p-3 font-medium text-foreground sticky left-0 z-10"
                            scope="row"
                          >
                            {hour.name}
                          </th>
                          {rules.daysOfTheWeek.map((day, dayIndex) => {
                            const cell = timetableData?.[hourIndex]?.[dayIndex];
                            
                            if (cell === 'spanned') {
                              return null;
                            }
                            
                            if (cell) {
                              return (
                                <td 
                                  key={`${day.name}-${hour.name}`} 
                                  className="border border-border p-3 text-left text-sm align-top bg-primary/10 activity-cell"
                                  rowSpan={cell.duration > 1 ? cell.duration : undefined}
                                >
                                  <div className="font-semibold text-primary">{cell.subject}</div>
                                  {viewType !== 'teachers' && cell.teachers.length > 0 && (
                                    <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1">
                                      <UserCircle className="h-3 w-3" aria-hidden="true" />
                                      {cell.teachers.join(', ')}
                                    </div>
                                  )}
                                  {viewType !== 'students' && cell.students.length > 0 && (
                                    <div className="text-subtle text-xs flex items-center gap-1.5 mt-1">
                                      <Users className="h-3 w-3" aria-hidden="true" />
                                      {cell.students.join(', ')}
                                    </div>
                                  )}
                                  {cell.room && (
                                    <div className="text-info text-xs flex items-center gap-1.5 mt-1">
                                      <Building2 className="h-3 w-3" aria-hidden="true" />
                                      {cell.room}
                                    </div>
                                  )}
                                  {cell.activityTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {cell.activityTags.map((tag, ti) => (
                                        <Badge key={ti} variant="outline" className="text-xs py-0 px-1.5 text-accent border-accent/50">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {cell.duration > 1 && (
                                    <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1">
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                      {cell.duration}h
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            
                            return (
                              <td 
                                key={`${day.name}-${hour.name}`} 
                                className="border border-border p-3 text-left text-sm align-top bg-card"
                              />
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

          {statistics && (
            <div className="grid gap-4 md:grid-cols-4 stagger-children">
              <StatCard 
                title="Total Periods" 
                value={statistics.totalPeriods} 
                icon={<Calendar className="h-5 w-5" aria-hidden="true" />} 
              />
              <StatCard 
                title="Average Per Day" 
                value={statistics.averagePerDay.toFixed(1)} 
                icon={<Clock className="h-5 w-5" aria-hidden="true" />} 
              />
              <StatCard 
                title="Total Gaps" 
                value={statistics.totalGaps} 
                icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} 
              />
              <StatCard 
                title="Conflicts" 
                value={latestSolution.conflicts.length} 
                icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} 
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
