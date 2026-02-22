'use client';

import { mockUsers } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Phone } from 'lucide-react';

export default function VendorsPage() {
  const vendors = mockUsers.filter((user) => user.role === 'vendor');

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Vendors</h1>
          <p className="text-slate-400 mt-1">Manage contractors and service providers</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Add Vendor
        </Button>
      </div>

      {/* Vendors List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vendors.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 md:col-span-2">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">No vendors found</p>
            </CardContent>
          </Card>
        ) : (
          vendors.map((vendor) => (
            <Card key={vendor.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-slate-100">{vendor.avatar}</span>
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">{vendor.name}</CardTitle>
                    <p className="text-xs text-slate-400 mt-1">Service Provider</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">{vendor.email}</span>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-400 mb-3">Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-slate-300">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
