'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

interface Building {
  id: number;
  name: string;
  address: string | null;
  building_type: string;
  property_manager_email: string | null;
  property_manager_name: string | null;
  rules_and_regulations: string | null;
  created_at: string;
}

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState('condo');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editType, setEditType] = useState('condo');
  const [editManagerEmail, setEditManagerEmail] = useState('');
  const [editManagerName, setEditManagerName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const fetchBuildings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) setBuildings(data as Building[]);
      else console.error('Error loading buildings', error);

      setLoading(false);
    };

    fetchBuildings();
  }, []);

  const resetNewForm = () => {
    setNewName('');
    setNewAddress('');
    setNewType('condo');
    setNewManagerEmail('');
    setNewManagerName('');
  };

  const handleCreateBuilding = async () => {
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('buildings')
        .insert({
          name: newName.trim(),
          address: newAddress.trim() || null,
          building_type: newType,
          property_manager_email: newManagerEmail.trim() || null,
          property_manager_name: newManagerName.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating building', error);
        setCreating(false);
        return;
      }

      if (data) {
        setBuildings((prev) => [data as Building, ...prev]);
      }

      resetNewForm();
    } catch (err) {
      console.error('Error creating building', err);
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (building: Building) => {
    setEditingId(building.id);
    setEditName(building.name);
    setEditAddress(building.address ?? '');
    setEditType(building.building_type);
    setEditManagerEmail(building.property_manager_email ?? '');
    setEditManagerName(building.property_manager_name ?? '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditAddress('');
    setEditType('condo');
    setEditManagerEmail('');
    setEditManagerName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);

    try {
      const { data, error } = await supabase
        .from('buildings')
        .update({
          name: editName.trim(),
          address: editAddress.trim() || null,
          building_type: editType,
          property_manager_email: editManagerEmail.trim() || null,
          property_manager_name: editManagerName.trim() || null,
        })
        .eq('id', editingId)
        .select()
        .single();

      if (error) {
        console.error('Error updating building', error);
        setSavingEdit(false);
        return;
      }

      if (data) {
        setBuildings((prev) =>
          prev.map((b) => (b.id === editingId ? (data as Building) : b)),
        );
      }

      cancelEditing();
    } catch (err) {
      console.error('Error updating building', err);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Buildings</h1>
          <p className="text-slate-500 mt-1">
            Manage buildings, managers, and addresses
          </p>
        </div>
      </div>

      {/* New building form */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Building
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Building name"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Address
              </label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Building address"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
              >
                <option value="condo">Condominium</option>
                <option value="rental">Rental</option>
                <option value="housing-co-op">Housing Co-op</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Property Manager Name
              </label>
              <Input
                value={newManagerName}
                onChange={(e) => setNewManagerName(e.target.value)}
                placeholder="Full name"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Property Manager Email
              </label>
              <Input
                value={newManagerEmail}
                onChange={(e) => setNewManagerEmail(e.target.value)}
                placeholder="manager@example.com"
                className="text-sm"
              />
            </div>
          </div>
          <Button
            onClick={handleCreateBuilding}
            disabled={creating || !newName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {creating ? 'Creating...' : 'Create Building'}
          </Button>
        </CardContent>
      </Card>

      {/* Buildings list */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Existing Buildings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 text-sm py-4">Loading buildings...</p>
          ) : buildings.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">
              No buildings found in the system.
            </p>
          ) : (
            <div className="space-y-2">
              {buildings.map((building) => {
                const isEditing = editingId === building.id;
                return (
                  <div
                    key={building.id}
                    className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Building name"
                                className="mb-1 text-sm"
                              />
                              <Input
                                value={editAddress}
                                onChange={(e) =>
                                  setEditAddress(e.target.value)
                                }
                                placeholder="Building address"
                                className="text-sm"
                              />
                            </>
                          ) : (
                            <>
                              <h4 className="font-semibold text-slate-900 truncate">
                                {building.name}
                              </h4>
                              <p className="text-sm text-slate-600 truncate">
                                {building.address ?? 'No address set'}
                              </p>
                            </>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {building.building_type} • Managed by{' '}
                            {building.property_manager_name ??
                              building.property_manager_email ??
                              'Unassigned'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              disabled={savingEdit}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
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
                              onClick={() => startEditing(building)}
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

                    {isEditing && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">
                            Type
                          </label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                          >
                            <option value="condo">Condominium</option>
                            <option value="rental">Rental</option>
                            <option value="housing-co-op">
                              Housing Co-op
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">
                            Property Manager Name
                          </label>
                          <Input
                            value={editManagerName}
                            onChange={(e) =>
                              setEditManagerName(e.target.value)
                            }
                            placeholder="Full name"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">
                            Property Manager Email
                          </label>
                          <Input
                            value={editManagerEmail}
                            onChange={(e) =>
                              setEditManagerEmail(e.target.value)
                            }
                            placeholder="manager@example.com"
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
    </div>
  );
}
