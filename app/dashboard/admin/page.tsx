'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Mail,
  Settings,
  Lock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

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

interface Vendor {
  id: number;
  company_name: string;
  category: string;
  building_ids: string | null;
  email: string | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Resident');
  const [editBuildingId, setEditBuildingId] = useState<number | null>(null);
  const [editSuite, setEditSuite] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Editing Building state
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null);
  const [editBName, setEditBName] = useState('');
  const [editBAddress, setEditBAddress] = useState('');
  const [editBPmEmail, setEditBPmEmail] = useState('');
  const [savingBuilding, setSavingBuilding] = useState(false);

  // Building SMTP state
  const [bSmtpHost, setBSmtpHost] = useState('');
  const [bSmtpPort, setBSmtpPort] = useState('587');
  const [bSmtpUser, setBSmtpUser] = useState('');
  const [bSmtpPass, setBSmtpPass] = useState('');
  const [bSmtpFromName, setBSmtpFromName] = useState('');
  const [bSmtpFromEmail, setBSmtpFromEmail] = useState('');
  const [bSmtpId, setBSmtpId] = useState<number | null>(null);

  // New user state
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Resident');
  const [newBuildingId, setNewBuildingId] = useState<number | null>(null);
  const [newSuite, setNewSuite] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // SMTP Settings state
  const [smtpId, setSmtpId] = useState<number | null>(null);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('JANUS Property Management');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('STARTTLS');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [syncingEmails, setSyncingEmails] = useState(false);

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

    const fetchSmtpSettings = async () => {
      const { data, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

      if (!error && data) {
        setSmtpId(data.id);
        setSmtpHost(data.host || '');
        setSmtpPort(String(data.port || '587'));
        setSmtpUser(data.username || '');
        setSmtpPass(data.password || '');
        setSmtpFromName(data.from_name || '');
        setSmtpFromEmail(data.from_email || '');
        setSmtpEncryption(data.port === 465 ? 'SSL/TLS' : 'STARTTLS');
      }
    };

    const fetchVendors = async () => {
      setLoadingVendors(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('company_name', { ascending: true });

      if (!error && data) setVendors(data as Vendor[]);
      else console.error('Error loading vendors', error);
      setLoadingVendors(false);
    };

    fetchUsers();
    fetchBuildings();
    fetchVendors();
    fetchSmtpSettings();
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

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name ?? '');
    setEditRole(user.role);
    setEditBuildingId(user.building_id);
    setEditSuite(user.suite_number ?? '');
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditName('');
    setEditSuite('');
    setEditBuildingId(null);
  };

  const saveUser = async () => {
    if (!editingUserId) return;
    setSavingUser(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          name: editName.trim() || null,
          role: editRole,
          building_id: editBuildingId,
          suite_number: editSuite.trim() || null,
        })
        .eq('id', editingUserId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user', error);
        setSavingUser(false);
        return;
      }

      if (data) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUserId ? (data as User) : u)),
        );
      }

      cancelEditUser();
    } catch (err) {
      console.error('Error updating user', err);
    } finally {
      setSavingUser(false);
    }
  };

  const startEditBuilding = async (building: Building) => {
    setEditingBuildingId(building.id);
    setEditBName(building.name);
    setEditBAddress(building.address ?? '');
    setEditBPmEmail(building.property_manager_email ?? '');

    // Fetch building SMTP
    const { data } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('building_id', building.id)
      .maybeSingle();

    if (data) {
      setBSmtpId(data.id);
      setBSmtpHost(data.host || '');
      setBSmtpPort(String(data.port || '587'));
      setBSmtpUser(data.username || '');
      setBSmtpPass(data.password || '');
      setBSmtpFromName(data.from_name || '');
      setBSmtpFromEmail(data.from_email || '');
    } else {
      setBSmtpId(null);
      setBSmtpHost('');
      setBSmtpPort('587');
      setBSmtpUser('');
      setBSmtpPass('');
      setBSmtpFromName('');
      setBSmtpFromEmail('');
    }
  };

  const cancelEditBuilding = () => {
    setEditingBuildingId(null);
    setEditBName('');
    setEditBAddress('');
    setEditBPmEmail('');
    setBSmtpId(null);
    setBSmtpHost('');
    setBSmtpUser('');
    setBSmtpPass('');
    setBSmtpFromName('');
    setBSmtpFromEmail('');
  };

  const saveBuilding = async () => {
    if (!editingBuildingId) return;
    setSavingBuilding(true);

    try {
      const { data, error } = await supabase
        .from('buildings')
        .update({
          name: editBName,
          address: editBAddress,
          property_manager_email: editBPmEmail,
        })
        .eq('id', editingBuildingId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setBuildings((prev) =>
          prev.map((b) => (b.id === editingBuildingId ? (data as Building) : b)),
        );
      }

      // Save building SMTP if any field is filled or if it already exists
      if (bSmtpHost || bSmtpUser || bSmtpId) {
        const smtpPayload = {
          building_id: editingBuildingId,
          host: bSmtpHost,
          port: Number(bSmtpPort),
          username: bSmtpUser,
          password: bSmtpPass,
          from_name: bSmtpFromName,
          from_email: bSmtpFromEmail,
          is_default: false,
        };

        if (bSmtpId) {
          await supabase.from('smtp_settings').update(smtpPayload).eq('id', bSmtpId);
        } else {
          await supabase.from('smtp_settings').insert([smtpPayload]);
        }
      }

      cancelEditBuilding();
    } catch (err) {
      console.error('Error saving building', err);
      alert('Failed to save building');
    } finally {
      setSavingBuilding(false);
    }
  };

  const handleToggleVendorAssignment = async (vendor: Vendor, buildingId: number) => {
    const currentIds = vendor.building_ids ? vendor.building_ids.split(',').map(s => s.trim()) : [];
    const bidStr = String(buildingId);

    let nextIds;
    if (currentIds.includes(bidStr)) {
      nextIds = currentIds.filter(id => id !== bidStr);
    } else {
      nextIds = [...currentIds, bidStr];
    }

    const { error } = await supabase
      .from('vendors')
      .update({ building_ids: nextIds.join(',') })
      .eq('id', vendor.id);

    if (!error) {
      setVendors(prev => prev.map(v =>
        v.id === vendor.id ? { ...v, building_ids: nextIds.join(',') } : v
      ));
    } else {
      console.error('Error toggling vendor assignment', error);
      alert('Failed to update vendor assignment');
    }
  };

  const getBuildingName = (id: number | null) => {
    if (!id) return '—';
    const b = buildings.find((b) => b.id === id);
    return b ? b.name : `ID ${id}`;
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim()) return;
    setCreatingUser(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: newEmail.trim(),
          name: newName.trim() || null,
          role: newRole,
          building_id: newBuildingId,
          suite_number: newSuite.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user', error);
        setCreatingUser(false);
        return;
      }

      if (data) {
        setUsers((prev) => [data as User, ...prev]);
      }

      // Reset form
      setNewName('');
      setNewEmail('');
      setNewRole('Resident');
      setNewBuildingId(null);
      setNewSuite('');
      setShowNewUserForm(false);
    } catch (err) {
      console.error('Error creating user', err);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const payload = {
        host: smtpHost,
        port: Number(smtpPort),
        username: smtpUser,
        password: smtpPass,
        from_name: smtpFromName,
        from_email: smtpFromEmail,
        is_default: true,
      };

      let error;
      if (smtpId) {
        const { error: updateError } = await supabase
          .from('smtp_settings')
          .update(payload)
          .eq('id', smtpId);
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('smtp_settings')
          .insert([payload])
          .select()
          .single();
        error = insertError;
        if (data) setSmtpId(data.id);
      }

      if (error) throw error;
      alert('SMTP settings saved successfully!');
    } catch (err) {
      console.error('Error saving SMTP settings:', err);
      alert('Failed to save SMTP settings.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          username: smtpUser,
          password: smtpPass,
          fromName: smtpFromName,
          fromEmail: smtpFromEmail,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert('Test email sent! Check your inbox.');
      } else {
        alert(`Test failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error testing SMTP:', err);
      alert('Error testing SMTP connection.');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSyncEmails = async () => {
    setSyncingEmails(true);
    try {
      const res = await fetch('/api/admin/sync-emails', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        alert(`Successfully synced! Processed ${data.processedCount} new emails.`);
        // Reload users if any new ones might have been created
        // window.location.reload(); 
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error syncing emails:', err);
      alert('Error connecting to sync service.');
    } finally {
      setSyncingEmails(false);
    }
  };

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
        <div className="flex gap-3">
          <Button
            onClick={handleSyncEmails}
            disabled={syncingEmails}
            variant="outline"
            className="border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Mail className="w-4 h-4 mr-2" />
            {syncingEmails ? 'Syncing...' : 'Sync Emails Now'}
          </Button>
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
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <Settings className="w-4 h-4 mr-2" />
            Email Settings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-slate-900">Users</CardTitle>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                onClick={() => setShowNewUserForm((v) => !v)}
              >
                <Plus className="w-4 h-4" />
                {showNewUserForm ? 'Cancel' : 'Add User'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New user form */}
              {showNewUserForm && (
                <div className="p-4 mb-2 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Name
                      </label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Full name"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Email
                      </label>
                      <Input
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Role
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) =>
                          setNewRole(e.target.value as UserRole)
                        }
                        className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                      >
                        <option value="Resident">Resident</option>
                        <option value="Owner">Owner</option>
                        <option value="Agent">Agent</option>
                        <option value="PropertyManager">
                          Property Manager
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Building
                      </label>
                      <select
                        value={newBuildingId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewBuildingId(v === '' ? null : Number(v));
                        }}
                        className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Suite / Unit
                      </label>
                      <Input
                        value={newSuite}
                        onChange={(e) => setNewSuite(e.target.value)}
                        placeholder="e.g. 1203"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateUser}
                    disabled={creatingUser || !newEmail.trim()}
                    className="bg-[#3EB489] hover:bg-[#36a27b] text-white"
                  >
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              )}

              {loadingUsers ? (
                <p className="text-slate-500 text-sm py-4">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">
                  No users found in the system.
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => {
                    const isEditing = editingUserId === user.id;
                    return (
                      <div
                        key={user.id}
                        className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
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
                              {isEditing ? (
                                <>
                                  <Input
                                    value={editName}
                                    onChange={(e) =>
                                      setEditName(e.target.value)
                                    }
                                    placeholder="Name"
                                    className="mb-1 text-sm"
                                  />
                                  <p className="text-sm text-slate-600 truncate">
                                    {user.email}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <h4 className="font-semibold text-slate-900 truncate">
                                    {user.name ?? 'Unnamed user'}
                                  </h4>
                                  <p className="text-sm text-slate-600 truncate">
                                    {user.email}
                                  </p>
                                </>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                Unit {user.suite_number ?? '—'} •{' '}
                                {getBuildingName(user.building_id)}
                              </p>
                            </div>
                            <span
                              className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium border capitalize ${getRoleColor(
                                user.role,
                              )}`}
                            >
                              {user.role}
                            </span>
                          </div>
                          <div className="flex gap-2 ml-4 flex-shrink-0">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={saveUser}
                                  disabled={savingUser}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditUser}
                                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditUser(user)}
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
                              </>
                            )}
                          </div>
                        </div>

                        {/* Edit controls: role + building + suite */}
                        {isEditing && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                Role
                              </label>
                              <select
                                value={editRole}
                                onChange={(e) =>
                                  setEditRole(e.target.value as UserRole)
                                }
                                className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                              >
                                <option value="Resident">Resident</option>
                                <option value="Owner">Owner</option>
                                <option value="Agent">Agent</option>
                                <option value="PropertyManager">
                                  Property Manager
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                Building
                              </label>
                              <select
                                value={editBuildingId ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditBuildingId(
                                    v === '' ? null : Number(v),
                                  );
                                }}
                                className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                              >
                                <option value="">Unassigned</option>
                                {buildings.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                Suite / Unit
                              </label>
                              <Input
                                value={editSuite}
                                onChange={(e) =>
                                  setEditSuite(e.target.value)
                                }
                                placeholder="e.g. 1203"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buildings Tab (display only) */}
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
                <div className="space-y-4">
                  {buildings.map((building) => {
                    const isEditing = editingBuildingId === building.id;
                    const buildingVendors = vendors.filter(v =>
                      v.building_ids && v.building_ids.split(',').map(s => s.trim()).includes(String(building.id))
                    );

                    return (
                      <Card key={building.id} className="border border-slate-200 overflow-hidden">
                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="space-y-2 max-w-md">
                                  <Input
                                    value={editBName}
                                    onChange={(e) => setEditBName(e.target.value)}
                                    placeholder="Building Name"
                                    className="h-8 text-sm"
                                  />
                                  <Input
                                    value={editBAddress}
                                    onChange={(e) => setEditBAddress(e.target.value)}
                                    placeholder="Address"
                                    className="h-8 text-sm"
                                  />
                                  <Input
                                    value={editBPmEmail}
                                    onChange={(e) => setEditBPmEmail(e.target.value)}
                                    placeholder="PM Email"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              ) : (
                                <>
                                  <h4 className="font-semibold text-slate-900 truncate">
                                    {building.name}
                                  </h4>
                                  <p className="text-sm text-slate-600 truncate">
                                    {building.address ?? 'No address set'}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {buildingVendors.length > 0 ? (
                                      buildingVendors.slice(0, 3).map(v => (
                                        <span key={v.id} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                          {v.company_name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">No vendors assigned</span>
                                    )}
                                    {buildingVendors.length > 3 && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                        +{buildingVendors.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4 flex-shrink-0">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={saveBuilding}
                                  disabled={savingBuilding}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditBuilding}
                                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditBuilding(building)}
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
                              </>
                            )}
                          </div>
                        </div>

                        {/* Vendor Assignment Section (Only in Editing) */}
                        {isEditing && (
                          <div className="bg-slate-50 border-t border-slate-200 p-4">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Users className="w-3 h-3" />
                              Vendor Assignments
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {['plumbing', 'electrical', 'hvac', 'appliance', 'pest', 'other'].map(cat => {
                                const catVendors = vendors.filter(v => v.category === cat);
                                return (
                                  <div key={cat} className="space-y-2">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">{cat}</p>
                                    {catVendors.length === 0 ? (
                                      <p className="text-[10px] text-slate-400 italic">No vendors</p>
                                    ) : (
                                      catVendors.map(v => {
                                        const isAssigned = v.building_ids?.split(',').map(s => s.trim()).includes(String(building.id));
                                        return (
                                          <label key={v.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                                            <input
                                              type="checkbox"
                                              checked={!!isAssigned}
                                              onChange={() => handleToggleVendorAssignment(v, building.id)}
                                              className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-slate-600 truncate">{v.company_name}</span>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SMTP Assignment Section (Only in Editing) */}
                        {isEditing && (
                          <div className="bg-blue-50/30 border-t border-slate-200 p-4">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              Building SMTP Configuration (Optional)
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Host</label>
                                  <Input
                                    value={bSmtpHost}
                                    onChange={(e) => setBSmtpHost(e.target.value)}
                                    placeholder="smtp.gmail.com"
                                    className="h-8 text-sm bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Port</label>
                                    <Input
                                      value={bSmtpPort}
                                      onChange={(e) => setBSmtpPort(e.target.value)}
                                      placeholder="587"
                                      className="h-8 text-sm bg-white"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Encryption</label>
                                    <select
                                      className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none"
                                      value={bSmtpPort === '465' ? 'SSL/TLS' : 'STARTTLS'}
                                      onChange={(e) => setBSmtpPort(e.target.value === 'SSL/TLS' ? '465' : '587')}
                                    >
                                      <option>STARTTLS</option>
                                      <option>SSL/TLS</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase">User / Email</label>
                                  <Input
                                    value={bSmtpUser}
                                    onChange={(e) => setBSmtpUser(e.target.value)}
                                    placeholder="user@gmail.com"
                                    className="h-8 text-sm bg-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Pass / App Secret</label>
                                  <Input
                                    type="password"
                                    value={bSmtpPass}
                                    onChange={(e) => setBSmtpPass(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="h-8 text-sm bg-white"
                                  />
                                </div>
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase">From Name</label>
                                  <Input
                                    value={bSmtpFromName}
                                    onChange={(e) => setBSmtpFromName(e.target.value)}
                                    placeholder="e.g. Building A Management"
                                    className="h-8 text-sm bg-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase">From Email</label>
                                  <Input
                                    value={bSmtpFromEmail}
                                    onChange={(e) => setBSmtpFromEmail(e.target.value)}
                                    placeholder="noreply@buildingA.com"
                                    className="h-8 text-sm bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                            <p className="mt-3 text-[10px] text-slate-400 italic">
                              Leave empty to use the system-wide default SMTP settings.
                            </p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">SMTP Settings</h3>
                  <p className="text-blue-100 text-sm">Configure email account for sending tickets and notifications</p>
                </div>
              </div>
            </div>

            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Connection Settings */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Connection Configuration
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">SMTP Host</label>
                      <Input
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">SMTP Port</label>
                        <Input
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="587"
                          className="bg-slate-50 border-slate-200 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Encryption</label>
                        <select
                          value={smtpEncryption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSmtpEncryption(val);
                            if (val === 'SSL/TLS (Port 465)') setSmtpPort('465');
                            if (val === 'STARTTLS (Port 587)') setSmtpPort('587');
                          }}
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                        >
                          <option>STARTTLS (Port 587)</option>
                          <option>SSL/TLS (Port 465)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authentication */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    Authentication
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">SMTP Username</label>
                      <Input
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="user@example.com"
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">SMTP Password</label>
                      <Input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                      <p className="text-[10px] text-slate-400 italic">Use an App Password for Gmail accounts</p>
                    </div>
                  </div>
                </div>

                {/* Sender Identity */}
                <div className="md:col-span-2 space-y-6">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Sender Identity
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">From Name</label>
                      <Input
                        value={smtpFromName}
                        onChange={(e) => setSmtpFromName(e.target.value)}
                        placeholder="JANUS Property Management"
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">From Email</label>
                      <Input
                        value={smtpFromEmail}
                        onChange={(e) => setSmtpFromEmail(e.target.value)}
                        placeholder="no-reply@janus.local"
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <Button
                  variant="outline"
                  className="text-slate-600 border-slate-200"
                  onClick={handleTestConnection}
                  disabled={testingSmtp}
                >
                  {testingSmtp ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
                  onClick={handleSaveSmtp}
                  disabled={savingSmtp}
                >
                  {savingSmtp ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scaling Information Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <div className="p-1 bg-amber-100 rounded text-amber-600 h-fit">
              <ChevronRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Scalable Infrastructure Note</p>
              <p className="text-xs text-amber-700 mt-1">
                This configuration currently sets the system-wide default. To enable per-company or per-building SMTP
                profiles, you can link specific buildings to unique SMTP credentials in the Buildings tab.
              </p>
            </div>
          </div>
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
