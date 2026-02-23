'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight, Filter } from 'lucide-react';

type TicketStatus =
  | 'new'
  | 'in-progress'
  | 'completed'
  | 'escalated'
  | 'pending-approval';
type Urgency = 'low' | 'medium' | 'high';

interface Ticket {
  id: string;
  ticket_id: string;
  state: TicketStatus;
  type: string | null;
  urgency: Urgency | null;
  building: string | null;
  unit_number: string | null;
  created_at: string;
  assignedTo?: string | null;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTickets(data as Ticket[]);
      } else {
        console.error('Error loading tickets', error);
      }
      setLoading(false);
    };

    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch = statusFilter === 'all' || ticket.state === statusFilter;
    const urgencyMatch =
      urgencyFilter === 'all' || ticket.urgency === urgencyFilter;
    return statusMatch && urgencyMatch;
  });

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'new':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'in-progress':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'completed':
        return 'bg-green-50 text-green-600 border-green-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'low':
        return 'bg-green-50 text-green-600 border-green-200';
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tickets</h1>
          <p className="text-slate-500 mt-1">
            Manage maintenance and support requests
          </p>
        </div>
        {/* New Ticket button with mint leaf color */}
        <Link href="/dashboard/tickets/new">
          <Button className="bg-[#3EB489] hover:bg-[#36a27b] text-white shadow-sm hover:shadow-md">
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <CardTitle className="text-slate-900">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'new', 'in-progress', 'completed'].map((status) => (
                  <Button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    className={`text-sm ${
                      statusFilter === status
                        ? 'bg-[#3EB489] hover:bg-[#36a27b] text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {status === 'all'
                      ? 'All'
                      : status === 'in-progress'
                      ? 'In Progress'
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Urgency
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'high', 'medium', 'low'].map((urgency) => (
                  <Button
                    key={urgency}
                    onClick={() => setUrgencyFilter(urgency as any)}
                    variant={urgencyFilter === urgency ? 'default' : 'outline'}
                    className={`text-sm ${
                      urgencyFilter === urgency
                        ? 'bg-[#3EB489] hover:bg-[#36a27b] text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {urgency === 'all'
                      ? 'All'
                      : urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">Loading tickets...</p>
            </CardContent>
          </Card>
        ) : filteredTickets.length === 0 ? (
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">
                No tickets found matching your filters
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/tickets/${ticket.ticket_id}`}
            >
              <Card className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-slate-900 truncate text-balance">
                          {ticket.type ?? 'Ticket'}
                        </h3>
                        <span
                          className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium border ${getStatusColor(
                            ticket.state
                          )}`}
                        >
                          {ticket.state === 'new'
                            ? 'New'
                            : ticket.state === 'in-progress'
                            ? 'In Progress'
                            : 'Completed'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>{ticket.ticket_id}</span>
                        <span>
                          {(ticket.building ?? 'Unknown building')} • Unit{' '}
                          {ticket.unit_number ?? '—'}
                        </span>
                        <span>
                          Assigned to: {ticket.assignedTo || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-3">
                      {ticket.urgency && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium border ${getUrgencyColor(
                            ticket.urgency
                          )}`}
                        >
                          {ticket.urgency.charAt(0).toUpperCase() +
                            ticket.urgency.slice(1)}{' '}
                          Priority
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Summary */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {filteredTickets.filter((t) => t.state === 'new').length}
              </p>
              <p className="text-sm text-slate-500">New</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {filteredTickets.filter((t) => t.state === 'in-progress').length}
              </p>
              <p className="text-sm text-slate-500">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {filteredTickets.filter((t) => t.state === 'completed').length}
              </p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
