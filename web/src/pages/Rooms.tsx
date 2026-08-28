import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, Building2, DoorOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { PageHeader, StatCard, EmptyState } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadRooms, addRoom, updateRoom, deleteRoom, addBuilding, updateBuilding, deleteBuilding } from '@/store/slices/roomsSlice';
import type { Room, Building } from '@/types';

type DialogMode = 'room' | 'building';

export function Rooms() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { rooms, buildings, loading } = useAppSelector((state) => state.rooms);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('room');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  
  const [roomFormData, setRoomFormData] = useState({
    name: '',
    longName: '',
    code: '',
    capacity: 30,
    buildingId: '',
    isVirtual: false,
    comments: '',
  });
  
  const [buildingFormData, setBuildingFormData] = useState({
    name: '',
    longName: '',
    code: '',
    comments: '',
  });

  useEffect(() => {
    dispatch(loadRooms());
  }, [dispatch]);

  const findBuildingId = (idOrName?: string): string => {
    if (!idOrName) return '';
    const byId = buildings.find(b => b.id === idOrName);
    if (byId) return byId.id;
    const byName = buildings.find(b => b.name === idOrName);
    if (byName) return byName.id;
    return '';
  };

  const getBuildingName = (buildingId?: string): string => {
    if (!buildingId) return '';
    const building = buildings.find(b => b.id === buildingId || b.name === buildingId);
    return building?.name || buildingId;
  };

  const filteredRooms = useMemo(() => {
    if (!searchQuery) return rooms;
    const query = searchQuery.toLowerCase();
    return rooms.filter(
      (r) => r.name.toLowerCase().includes(query) || r.longName?.toLowerCase().includes(query) || r.code?.toLowerCase().includes(query)
    );
  }, [rooms, searchQuery]);

  const {
    paginatedItems: paginatedRooms,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredRooms, { initialPageSize: 12 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openRoomDialog = (room?: Room) => {
    setDialogMode('room');
    setEditingRoom(room || null);
    setRoomFormData({
      name: room?.name || '',
      longName: room?.longName || '',
      code: room?.code || '',
      capacity: room?.capacity || 30,
      buildingId: room ? findBuildingId(room.buildingId) : '',
      isVirtual: room?.isVirtual || false,
      comments: room?.comments || '',
    });
    setIsDialogOpen(true);
  };

  const openBuildingDialog = (building?: Building) => {
    setDialogMode('building');
    setEditingBuilding(building || null);
    setBuildingFormData({
      name: building?.name || '',
      longName: building?.longName || '',
      code: building?.code || '',
      comments: building?.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoom) {
      dispatch(updateRoom({ ...editingRoom, ...roomFormData }));
    } else {
      dispatch(addRoom({ id: uuidv4(), ...roomFormData }));
    }
    setIsDialogOpen(false);
  };

  const handleBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBuilding) {
      dispatch(updateBuilding({ ...editingBuilding, ...buildingFormData }));
    } else {
      dispatch(addBuilding({ id: uuidv4(), ...buildingFormData }));
    }
    setIsDialogOpen(false);
  };

  const handleDeleteRoom = (room: Room) => {
    if (!confirm(t('rooms.confirmDeleteRoom', { name: room.name }))) return;
    dispatch(deleteRoom(room.id));
  };

  const handleDeleteBuilding = (building: Building) => {
    if (!confirm(t('rooms.confirmDeleteBuilding', { name: building.name }))) return;
    dispatch(deleteBuilding(building.id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('rooms.title')}
        description={t('rooms.description', { count: rooms.length })}
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openBuildingDialog()} className="gap-2 hover-lift">
              <Building2 className="h-4 w-4" />
              {t('rooms.addBuilding')}
            </Button>
            <Button onClick={() => openRoomDialog()} className="gap-2 gradient-primary hover-lift">
              <Plus className="h-4 w-4" />
              {t('rooms.addRoom')}
            </Button>
          </div>
        }
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        <StatCard title={t('rooms.stats.totalRooms')} value={rooms.length} icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard title={t('rooms.stats.buildings')} value={buildings.length} icon={<Building2 className="h-5 w-5" />} />
      </div>

      {/* Buildings section */}
      {buildings.length > 0 && (
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>{t('rooms.buildingsSection')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buildings.map(building => (
                <div key={building.id} className="group flex items-center gap-2 bg-muted rounded-lg px-3 py-2 hover:bg-muted/80 transition-colors">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{building.name}</span>
                  <Badge variant="outline">{t('rooms.roomsInBuilding', { count: rooms.filter(r => r.buildingId === building.id || r.buildingId === building.name).length })}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openBuildingDialog(building)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDeleteBuilding(building)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm animate-slide-up">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('rooms.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      {/* Rooms List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">{t('common.loading')}</div>
      ) : filteredRooms.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<DoorOpen className="h-12 w-12" />}
              title={searchQuery ? t('rooms.emptyTitleSearch') : t('rooms.emptyTitle')}
              description={searchQuery ? t('rooms.emptyDescriptionSearch') : t('rooms.emptyDescription')}
              action={!searchQuery && (
                <Button onClick={() => openRoomDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('rooms.addRoom')}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {paginatedRooms.map((room, index) => (
              <Card key={room.id} className="hover-lift" style={{ animationDelay: `${index * 30}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <DoorOpen className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {room.name}
                          {room.code && <span className="ml-2 text-sm text-muted-foreground">({room.code})</span>}
                        </CardTitle>
                        {room.longName && room.longName !== room.name && (
                          <CardDescription>{room.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRoomDialog(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRoom(room)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t('rooms.capacityBadge', { count: room.capacity })}</Badge>
                    {room.buildingId && <Badge variant="secondary">{getBuildingName(room.buildingId)}</Badge>}
                    {room.isVirtual && <Badge className="bg-primary">{t('rooms.virtualBadge')}</Badge>}
                  </div>
                  {room.comments && <p className="mt-2 text-sm text-muted-foreground">{room.comments}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Room Dialog */}
      <Dialog open={isDialogOpen && dialogMode === 'room'} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRoomSubmit}>
            <DialogHeader>
              <DialogTitle>{editingRoom ? t('rooms.editRoom') : t('rooms.addRoom')}</DialogTitle>
              <DialogDescription>{t('rooms.roomDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('common.name')} *</Label>
                <Input id="name" value={roomFormData.name} onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value })} placeholder={t('rooms.roomDialog.namePlaceholder')} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longName">{t('common.longName')}</Label>
                <Input id="longName" value={roomFormData.longName} onChange={(e) => setRoomFormData({ ...roomFormData, longName: e.target.value })} placeholder={t('rooms.roomDialog.longNamePlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">{t('common.code')}</Label>
                  <Input id="code" value={roomFormData.code} onChange={(e) => setRoomFormData({ ...roomFormData, code: e.target.value })} placeholder={t('rooms.roomDialog.codePlaceholder')} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="capacity">{t('rooms.roomDialog.capacity')}</Label>
                  <Input id="capacity" type="number" min="1" value={roomFormData.capacity} onChange={(e) => setRoomFormData({ ...roomFormData, capacity: parseInt(e.target.value) || 30 })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="building">{t('rooms.roomDialog.building')}</Label>
                <select id="building" value={roomFormData.buildingId} onChange={(e) => setRoomFormData({ ...roomFormData, buildingId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                  <option value="">{t('rooms.roomDialog.noBuilding')}</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isVirtual" checked={roomFormData.isVirtual} onChange={(e) => setRoomFormData({ ...roomFormData, isVirtual: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="isVirtual">{t('rooms.roomDialog.isVirtual')}</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments">{t('common.comments')}</Label>
                <Input id="comments" value={roomFormData.comments} onChange={(e) => setRoomFormData({ ...roomFormData, comments: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingRoom ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Building Dialog */}
      <Dialog open={isDialogOpen && dialogMode === 'building'} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleBuildingSubmit}>
            <DialogHeader>
              <DialogTitle>{editingBuilding ? t('rooms.editBuilding') : t('rooms.addBuilding')}</DialogTitle>
              <DialogDescription>{t('rooms.buildingDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bName">{t('common.name')} *</Label>
                <Input id="bName" value={buildingFormData.name} onChange={(e) => setBuildingFormData({ ...buildingFormData, name: e.target.value })} placeholder={t('rooms.buildingDialog.namePlaceholder')} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bLongName">{t('common.longName')}</Label>
                <Input id="bLongName" value={buildingFormData.longName} onChange={(e) => setBuildingFormData({ ...buildingFormData, longName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bCode">{t('common.code')}</Label>
                <Input id="bCode" value={buildingFormData.code} onChange={(e) => setBuildingFormData({ ...buildingFormData, code: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bComments">{t('common.comments')}</Label>
                <Input id="bComments" value={buildingFormData.comments} onChange={(e) => setBuildingFormData({ ...buildingFormData, comments: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingBuilding ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
