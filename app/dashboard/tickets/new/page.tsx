'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import Link from 'next/link';

type TicketType = 'repair' | 'complaint' | 'general';
type TicketUrgency = 'low' | 'medium' | 'high';

export default function NewTicketPage() {
  const router = useRouter();

  const [type, setType] = useState<TicketType>('repair');
  const [urgency, setUrgency] = useState<TicketUrgency>('medium');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!building.trim() || !unitNumber.trim() || !description.trim()) {
      setError('Building, unit number, and description are required.');
      return;
    }

    setSubmitting(true);

    const ticketId = `ticket-${Date.now()}`;

    const { error: insertError } = await supabase.from('tickets').insert({
      ticket_id: ticketId,
      state: 'new',
      type,
      urgency,
      building,
      unit_number: unitNumber,
    });

    setSubmitting(false);

    if (insertError) {
      console.error(insertError);
      setError('Failed to create ticket. Please try again.');
      return;
    }

    router.push(`/dashboard/tickets/${ticketId}`);
  };

  return (
    <div className="p-8 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Type</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TicketType)}
                  className="w-full rounded-md bg-white border border-slate-300 text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3EB489]/40 focus:border-[#3EB489]"
                >
                  <option value="repair">Repair</option>
                  <option value="complaint">Complaint</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Urgency</Label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as TicketUrgency)}
                  className="w-full rounded-md bg-white border border-slate-300 text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3EB489]/40 focus:border-[#3EB489]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Building</Label>
              <Input
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Maple Residences"
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#3EB489]/40 focus-visible:border-[#3EB489]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Unit Number</Label>
              <Input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 12B"
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#3EB489]/40 focus-visible:border-[#3EB489]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 min-h-[120px] focus-visible:ring-[#3EB489]/40 focus-visible:border-[#3EB489]"
              />
            </div>

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
