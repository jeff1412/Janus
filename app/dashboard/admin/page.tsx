'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Plus, Edit2, Trash2 } from 'lucide-react';

type UserRole = 'Resident' | 'Owner' | 'Agent' | 'PropertyManager';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  suite_number: string | null;
  building_id: number | null;
  created_at: string;
}

interface Building {
  id: number;
  name: string;
  address: string | null;
  building_type: string;
  property_manager_email: string | null;
  property_manager_name: string | null;
  rules_and_regulations: string | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingBuildings, setLoadingBuildings] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) setUsers(data as User[]);
      else console.error('Error loading users', error);

      setLoadingUsers(false);
    };

    const fetchBuildings = async () => {
      setLoadingBuildings(true);
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) setBuildings(data as Building[]);
      else console.error('Error loading buildings', error);

      setLoadingBuildings(false);
    };

    fetchUsers();
    fetchBuildings();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'PropertyManager':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Owner':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Resident':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Agent':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const totalUsers = users.length;
  const totalBuildings = buildings.length;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-500 mt-1">
            Manage users, buildings, and system settings
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="buildings"
            className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Buildings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-slate-900">Users</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <p className="text-slate-500 text-sm py-4">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">
                  No users found in the system.
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-slate-700">
                            {(user.name ?? user.email)
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {user.name ?? 'Unnamed user'}
                          </h4>
                          <p className="text-sm text-slate-600 truncate">
                            {user.email}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Unit {user.suite_number ?? '—'} • Building ID{' '}
                            {user.building_id ?? '—'}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium border capitalize ${getRoleColor(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="space-y-4">
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-slate-900">Buildings</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Add Building
              </Button>
            </CardHeader>
            <CardContent>
              {loadingBuildings ? (
                <p className="text-slate-500 text-sm py-4">
                  Loading buildings...
                </p>
              ) : buildings.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">
                  No buildings found in the system.
                </p>
              ) : (
                <div className="space-y-2">
                  {buildings.map((building) => (
                    <div
                      key={building.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {building.name}
                          </h4>
                          <p className="text-sm text-slate-600 truncate">
                            {building.address ?? 'No address set'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {building.building_type} • Managed by{' '}
                            {building.property_manager_name ??
                              building.property_manager_email ??
                              'Unassigned'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* System Status */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Total Buildings</p>
              <p className="text-2xl font-bold text-slate-900">
                {totalBuildings}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-500">System Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <p className="text-slate-800 font-medium">Operational</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
