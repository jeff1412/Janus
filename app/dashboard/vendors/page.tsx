'use client';

import { useEffect, useState } from 'react';
import { mockUsers } from '@/lib/mock-data';
import { supabase } from '../../../lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Mail, Phone } from 'lucide-react';

type DbVendor = {
  id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  // add these only if the columns exist in your table:
  // service_categories: string | null;
  // notes: string | null;
  active: boolean;
  created_at: string;
};

const mockVendors = mockUsers.filter((user) => user.role === 'vendor');

export default function VendorsPage() {
  const [dbVendors, setDbVendors] = useState<DbVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [serviceCategories, setServiceCategories] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
        setDbVendors([]);
      } else {
        setDbVendors((data || []) as DbVendor[]);
      }

      setLoading(false);
    };

    fetchVendors();
  }, []);

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        company_name: name, // satisfy NOT NULL company_name
        email: email || null,
        phone: phoneValue || null,
        // only include these if the columns exist in your table:
        // service_categories: serviceCategories || null,
        // notes: notes || null,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDbVendors((prev) => [data as DbVendor, ...prev]);
    setName('');
    setEmail('');
    setPhoneValue('');
    setServiceCategories('');
    setNotes('');
    setShowAddForm(false);
  };

  const allVendors = [
    ...mockVendors.map((v) => ({
      id: `mock-${v.id}`,
      company_name: v.name,
      email: v.email,
      phone: null as string | null,
      // adjust if you actually have these columns:
      // service_categories: 'Mock vendor',
      // notes: null as string | null,
      active: true,
      created_at: '',
      _isMock: true as const,
    })),
    ...dbVendors.map((v) => ({ ...v, _isMock: false as const })),
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Vendors</h1>
          <p className="text-slate-400 mt-1">
            Manage contractors and service providers
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancel' : 'Add Vendor'}
        </Button>
      </div>

      {/* Add Vendor form */}
      {showAddForm && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Add Vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}
            <form className="space-y-4" onSubmit={handleAddVendor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Name<span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Plumbing Co."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@vendor.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Phone
                  </label>
                  <Input
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="+63 9xx xxx xxxx"
                  />
                </div>
                {/* Only keep this if you added service_categories column */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Service Categories
                  </label>
                  <Input
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={serviceCategories}
                    onChange={(e) => setServiceCategories(e.target.value)}
                    placeholder="plumbing, electrical, hvac"
                  />
                </div>
              </div>
              {/* Only keep this if you added notes column */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Notes
                </label>
                <Textarea
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred contact times, coverage area, etc."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Vendor'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Vendors List */}
      {loading ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">Loading vendors...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allVendors.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 md:col-span-2">
              <CardContent className="py-12 text-center">
                <p className="text-slate-400">No vendors found</p>
              </CardContent>
            </Card>
          ) : (
            allVendors.map((vendor) => (
              <Card
                key={vendor.id}
                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-slate-100">
                        {(() => {
                          const safeName =
                            (vendor as any).company_name || 'V';
                          return safeName
                            .split(' ')
                            .filter(Boolean)
                            .map((n: string) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase();
                        })()}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">
                        {(vendor as any).company_name || 'Unnamed vendor'}
                      </CardTitle>
                      <p className="text-xs text-slate-400 mt-1">
                        {/* If you kept service_categories, use that here */}
                        {'Service Provider'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{vendor.phone}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-400 mb-3">Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm text-slate-300">
                        {(vendor as any)._isMock ? 'Mock (test)' : 'Active'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
