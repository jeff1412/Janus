'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import type { TicketType, TicketUrgency, Building } from '@/types';

export default function NewTicketPage() {
  const router = useRouter();

  const [type, setType] = useState<TicketType>('repair');
  const [urgency, setUrgency] = useState<TicketUrgency>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const [resident, setResident] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [repairCategory, setRepairCategory] = useState('');

  // NEW: residentName (explicit) and estimatedCost
  const [residentName, setResidentName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');

  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load buildings from Supabase
  useEffect(() => {
    const fetchBuildings = async () => {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setBuildings(data as Building[]);
        if (data.length > 0) setSelectedBuildingId(data[0].id);
      }
    };
    fetchBuildings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedBuildingId) {
      setError('Please select a building.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setSubmitting(true);

    const ticketId = `ticket-${Date.now()}`;
    const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

    const { error: insertError } = await supabase.from('tickets').insert({
      ticket_id: ticketId,
      state: 'new',
      type,
      urgency,
      subject: subject.trim() || null,
      damage_description: description.trim(),

      // existing resident fields
      resident: resident.trim() || null,
      sender_email: senderEmail.trim() || null,

      // NEW: denormalized resident name at time of ticket
      resident_name: (residentName || resident).trim() || null,

      building: selectedBuilding?.name ?? null,
      building_id: selectedBuildingId,
      unit_number: unitNumber.trim() || null,
      repair_category:
        type === 'repair' && repairCategory.trim() ? repairCategory.trim() : null,

      // NEW: estimated cost
      estimated_cost: estimatedCost.trim()
        ? Number(estimatedCost.trim())
        : null,
    });

    setSubmitting(false);

    if (insertError) {
      console.error(insertError);
      setError('Failed to create ticket. Please try again.');
      return;
    }

    router.push(`/dashboard/tickets/${ticketId}`);
  };

  const selectClass =
    'w-full rounded-md bg-white border border-slate-300 text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3EB489]/40 focus:border-[#3EB489]';
  const inputClass =
    'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#3EB489]/40 focus-visible:border-[#3EB489]';

  return (
    <div className="p-8 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tickets">
          <Button
            variant="ghost"
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[#3EB489]" />
            New Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Type + Urgency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Type</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TicketType)}
                  className={selectClass}
                >
                  <option value="repair">Repair</option>
                  <option value="complaint">Complaint</option>
                  <option value="condo_reject">Condo Reject</option>
                  <option value="general_inquiries_or_redesign">General Inquiry</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Urgency</Label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as TicketUrgency)}
                  className={selectClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-slate-700">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Ceiling leak in bathroom"
                className={inputClass}
              />
            </div>

            {/* Repair Category — only shown for repair type */}
            {type === 'repair' && (
              <div className="space-y-2">
                <Label className="text-slate-700">Repair Category</Label>
                <select
                  value={repairCategory}
                  onChange={(e) => setRepairCategory(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a category</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="structural">Structural</option>
                  <option value="appliance">Appliance</option>
                  <option value="pest">Pest Control</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}

            {/* Building + Unit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Building</Label>
                <select
                  value={selectedBuildingId ?? ''}
                  onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                  className={selectClass}
                >
                  {buildings.length === 0 && (
                    <option value="">Loading buildings...</option>
                  )}
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Unit Number</Label>
                <Input
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="e.g. 12B"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Resident + Email + NEW: Resident Name + Estimated Cost */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Resident (legacy field) */}
              <div className="space-y-2">
                <Label className="text-slate-700">Resident (legacy)</Label>
                <Input
                  value={resident}
                  onChange={(e) => setResident(e.target.value)}
                  placeholder="Optional, existing field"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Resident Email</Label>
                <Input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="e.g. john@email.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Resident Name (stored)</Label>
                <Input
                  value={residentName}
                  onChange={(e) => setResidentName(e.target.value)}
                  placeholder="e.g. John Santos"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Estimated Cost (₱)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="e.g. 1500.00"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-slate-700">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                className={`${inputClass} min-h-[120px]`}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => router.push('/dashboard/tickets')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#3EB489] hover:bg-[#36a27b] text-white shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
