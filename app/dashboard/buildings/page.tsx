'use client';

import { mockBuildings } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function BuildingsPage() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Buildings</h1>
          <p className="text-slate-400 mt-1">View and manage all properties</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Add Building
        </Button>
      </div>

      {/* Buildings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockBuildings.map((building) => (
          <Card key={building.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="text-slate-100">{building.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400">Address</label>
                <p className="text-slate-300 mt-1">{building.address}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400">Units</label>
                  <p className="text-slate-200 font-semibold mt-1">{building.units}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400">Managed By</label>
                  <p className="text-slate-200 font-semibold mt-1 text-sm truncate">
                    {building.managedBy}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
