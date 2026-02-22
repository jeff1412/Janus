'use client';

import { useState } from 'react';
import { mockTickets, TicketStatus, Urgency } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight, Filter } from 'lucide-react';

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');

  const filteredTickets = mockTickets.filter((ticket) => {
    const statusMatch = statusFilter === 'all' || ticket.status === statusFilter;
    const urgencyMatch = urgencyFilter === 'all' || ticket.urgency === urgencyFilter;
    return statusMatch && urgencyMatch;
  });

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in-progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Tickets</h1>
          <p className="text-slate-400 mt-1">Manage maintenance and support requests</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <CardTitle className="text-slate-100">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'new', 'in-progress', 'completed'].map((status) => (
                  <Button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    className={`${
                      statusFilter === status
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Urgency
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'high', 'medium', 'low'].map((urgency) => (
                  <Button
                    key={urgency}
                    onClick={() => setUrgencyFilter(urgency as any)}
                    variant={urgencyFilter === urgency ? 'default' : 'outline'}
                    className={`${
                      urgencyFilter === urgency
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {urgency === 'all' ? 'All' : urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">No tickets found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`}>
              <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-slate-100 truncate text-balance">
                          {ticket.title}
                        </h3>
                        <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium border ${getStatusColor(ticket.status)}`}>
                          {ticket.status === 'new' ? 'New' : ticket.status === 'in-progress' ? 'In Progress' : 'Completed'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        <span>{ticket.id}</span>
                        <span>{ticket.building} • Unit {ticket.unitNumber}</span>
                        <span>Assigned to: {ticket.assignedTo || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium border ${getUrgencyColor(ticket.urgency)}`}>
                        {ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)} Priority
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Summary */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-100">
                {filteredTickets.filter(t => t.status === 'new').length}
              </p>
              <p className="text-sm text-slate-400">New</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">
                {filteredTickets.filter(t => t.status === 'in-progress').length}
              </p>
              <p className="text-sm text-slate-400">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">
                {filteredTickets.filter(t => t.status === 'completed').length}
              </p>
              <p className="text-sm text-slate-400">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
