'use client';

import { mockUsers, mockBuildings } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Plus, Edit2, Trash2 } from 'lucide-react';

export default function AdminPage() {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'staff':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'vendor':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Administration</h1>
          <p className="text-slate-400 mt-1">Manage users, buildings, and system settings</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="users" className="data-[state=active]:bg-slate-800">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="buildings" className="data-[state=active]:bg-slate-800">
            <Building2 className="w-4 h-4 mr-2" />
            Buildings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-slate-100">Users</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-slate-100">{user.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-100 truncate">{user.name}</h4>
                        <p className="text-sm text-slate-400 truncate">{user.email}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium border capitalize ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-slate-100">Buildings</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Add Building
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockBuildings.map((building) => (
                  <div key={building.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-100 truncate">{building.name}</h4>
                        <p className="text-sm text-slate-400 truncate">{building.address}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {building.units} units • Managed by {building.managedBy}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* System Status */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-100">{mockUsers.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Total Buildings</p>
              <p className="text-2xl font-bold text-slate-100">{mockBuildings.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-400">System Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <p className="text-slate-200 font-medium">Operational</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
