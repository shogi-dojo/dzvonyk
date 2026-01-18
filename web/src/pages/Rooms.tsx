import React, { useState, useEffect, useMemo } from 'react';
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
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadRooms, addRoom, updateRoom, deleteRoom, addBuilding, updateBuilding, deleteBuilding } from '@/store/slices/roomsSlice';
import type { Room, Building } from '@/types';

type DialogMode = 'room' | 'building';

export function Rooms() {
  const dispatch = useAppDispatch();
  const { rooms, buildings, loading } = useAppSelector((state) => state.rooms);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('room');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  
  // Room form data
  const [roomFormData, setRoomFormData] = useState({
    name: '',
    longName: '',
    code: '',
    capacity: 30,
    buildingId: '',
    isVirtual: false,
    comments: '',
  });
  
  // Building form data
  const [buildingFormData, setBuildingFormData] = useState({
    name: '',
    longName: '',
    code: '',
    comments: '',
  });

  useEffect(() => {
    dispatch(loadRooms());
  }, [dispatch]);

  // Filter rooms by search
  const filteredRooms = useMemo(() => {
    if (!searchQuery) return rooms;
    const query = searchQuery.toLowerCase();
    return rooms.filter(
      (r) => 
        r.name.toLowerCase().includes(query) ||
        r.longName?.toLowerCase().includes(query) ||
        r.code?.toLowerCase().includes(query)
    );
  }, [rooms, searchQuery]);

  // Use pagination hook
  const {
    paginatedItems: paginatedRooms,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredRooms, { initialPageSize: 12 });

  // Reset to page 1 when search changes
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
      buildingId: room?.buildingId || '',
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
      dispatch(addRoom({
        id: uuidv4(),
        ...roomFormData,
      }));
    }
    setIsDialogOpen(false);
  };

  const handleBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBuilding) {
      dispatch(updateBuilding({ ...editingBuilding, ...buildingFormData }));
    } else {
      dispatch(addBuilding({
        id: uuidv4(),
        ...buildingFormData,
      }));
    }
    setIsDialogOpen(false);
  };

  const handleDeleteRoom = (room: Room) => {
    if (!confirm(`Delete room "${room.name}"?`)) return;
    dispatch(deleteRoom(room.id));
  };

  const handleDeleteBuilding = (building: Building) => {
    if (!confirm(`Delete building "${building.name}"?`)) return;
    dispatch(deleteBuilding(building.id));
  };

  const getBuildingName = (buildingId?: string): string => {
    if (!buildingId) return '';
    const building = buildings.find(b => b.id === buildingId || b.name === buildingId);
    return building?.name || buildingId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Rooms</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage rooms and buildings ({rooms.length} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openBuildingDialog()}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Building
          </Button>
          <Button onClick={() => openRoomDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rooms.length}</div>
            <p className="text-sm text-gray-500">
              Capacity: {rooms.reduce((sum, r) => sum + r.capacity, 0)} students
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Buildings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{buildings.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Buildings section */}
      {buildings.length > 0 && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Buildings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buildings.map(building => (
                <div
                  key={building.id}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"
                >
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-800 dark:text-gray-200">{building.name}</span>
                  <Badge variant="outline" className="text-gray-500">
                    {rooms.filter(r => r.buildingId === building.id || r.buildingId === building.name).length} rooms
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openBuildingDialog(building)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteBuilding(building)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Rooms List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredRooms.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery ? 'No rooms found matching your search.' : 'No rooms added yet.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedRooms.map((room) => (
              <Card key={room.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-5 w-5 text-green-500" />
                      <div>
                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                          {room.name}
                          {room.code && <span className="ml-2 text-sm text-gray-500">({room.code})</span>}
                        </CardTitle>
                        {room.longName && room.longName !== room.name && (
                          <CardDescription className="text-gray-500">{room.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openRoomDialog(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                      Capacity: {room.capacity}
                    </Badge>
                    {room.buildingId && (
                      <Badge variant="secondary">
                        {getBuildingName(room.buildingId)}
                      </Badge>
                    )}
                    {room.isVirtual && (
                      <Badge className="bg-blue-500">Virtual</Badge>
                    )}
                  </div>
                  {room.comments && (
                    <p className="mt-2 text-sm text-gray-500">{room.comments}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Room Dialog */}
      <Dialog open={isDialogOpen && dialogMode === 'room'} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800">
          <form onSubmit={handleRoomSubmit}>
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                Enter the details for the room.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="name"
                  value={roomFormData.name}
                  onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value })}
                  placeholder="e.g., Room 101"
                  required
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longName" className="text-gray-700 dark:text-gray-300">Long Name</Label>
                <Input
                  id="longName"
                  value={roomFormData.longName}
                  onChange={(e) => setRoomFormData({ ...roomFormData, longName: e.target.value })}
                  placeholder="e.g., Science Lab 101"
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code" className="text-gray-700 dark:text-gray-300">Code</Label>
                  <Input
                    id="code"
                    value={roomFormData.code}
                    onChange={(e) => setRoomFormData({ ...roomFormData, code: e.target.value })}
                    placeholder="e.g., R101"
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="capacity" className="text-gray-700 dark:text-gray-300">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={roomFormData.capacity}
                    onChange={(e) => setRoomFormData({ ...roomFormData, capacity: parseInt(e.target.value) || 30 })}
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="building" className="text-gray-700 dark:text-gray-300">Building</Label>
                <select
                  id="building"
                  value={roomFormData.buildingId}
                  onChange={(e) => setRoomFormData({ ...roomFormData, buildingId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="">No building</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isVirtual"
                  checked={roomFormData.isVirtual}
                  onChange={(e) => setRoomFormData({ ...roomFormData, isVirtual: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isVirtual" className="text-gray-700 dark:text-gray-300">Virtual room</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments" className="text-gray-700 dark:text-gray-300">Comments</Label>
                <Input
                  id="comments"
                  value={roomFormData.comments}
                  onChange={(e) => setRoomFormData({ ...roomFormData, comments: e.target.value })}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingRoom ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Building Dialog */}
      <Dialog open={isDialogOpen && dialogMode === 'building'} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800">
          <form onSubmit={handleBuildingSubmit}>
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {editingBuilding ? 'Edit Building' : 'Add Building'}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                Buildings help organize rooms by location.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bName" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="bName"
                  value={buildingFormData.name}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, name: e.target.value })}
                  placeholder="e.g., Main Building"
                  required
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bLongName" className="text-gray-700 dark:text-gray-300">Long Name</Label>
                <Input
                  id="bLongName"
                  value={buildingFormData.longName}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, longName: e.target.value })}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bCode" className="text-gray-700 dark:text-gray-300">Code</Label>
                <Input
                  id="bCode"
                  value={buildingFormData.code}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, code: e.target.value })}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bComments" className="text-gray-700 dark:text-gray-300">Comments</Label>
                <Input
                  id="bComments"
                  value={buildingFormData.comments}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, comments: e.target.value })}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingBuilding ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
