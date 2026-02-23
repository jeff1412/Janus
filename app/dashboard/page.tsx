'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type TicketState = 'new' | 'in-progress' | 'completed' | 'escalated' | 'pending-approval';
type TicketUrgency = 'low' | 'medium' | 'high';

interface Ticket {
  id: string;
  ticket_id: string;
  state: TicketState;
  type: string | null;
  urgency: TicketUrgency | null;
  building: string | null;
  unit_number: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setTickets(data as Ticket[]);
      } else {
        console.error('Error loading tickets', error);
      }
      setLoading(false);
    };

    fetchTickets();
  }, []);

  const urgentCount = tickets.filter((t) => t.urgency === 'high').length;
  const inProgressCount = tickets.filter((t) => t.state === 'in-progress').length;
  const completedCount = tickets.filter((t) => t.state === 'completed').length;
  const totalCount = tickets.length;

  const stats = [
    {
      title: 'Urgent Tickets',
      value: urgentCount,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'In Progress',
      value: inProgressCount,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Completed',
      value: completedCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Tickets',
      value: totalCount,
      icon: AlertCircle,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
    },
  ];

  const recentTickets = tickets.slice(0, 5);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome to JANUS Property Management
          </p>
        </div>
        <Link href="/dashboard/tickets/new">
          <Button className="bg-[#3EB489] hover:bg-[#36a27b] text-white gap-2 shadow-sm hover:shadow-md">
            <Plus className="w-4 h-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="bg-white border border-slate-200 shadow-sm"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-700">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {loading ? '—' : stat.value}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {stat.title === 'Urgent Tickets' && 'Require immediate attention'}
                  {stat.title === 'In Progress' && 'Currently being worked on'}
                  {stat.title === 'Completed' && 'Resolved this month'}
                  {stat.title === 'Total Tickets' && 'In the system'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Tickets */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900">Recent Tickets</CardTitle>
            <Link href="/dashboard/tickets">
              <Button
                variant="ghost"
                className="text-[#3EB489] hover:text-[#36a27b] hover:bg-[#3EB489]/10"
              >
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading tickets...</p>
          ) : recentTickets.length === 0 ? (
            <p className="text-slate-500 text-sm">No tickets yet.</p>
          ) : (
            <div className="space-y-4">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.ticket_id}`}
                  className="block p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {ticket.type ?? 'Ticket'}
                        </h3>
                        {ticket.urgency && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              ticket.urgency === 'high'
                                ? 'bg-red-50 text-red-600'
                                : ticket.urgency === 'medium'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-green-50 text-green-600'
                            }`}
                          >
                            {ticket.urgency.charAt(0).toUpperCase() +
                              ticket.urgency.slice(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {(ticket.building ?? 'Unknown building')}{' '}
                        {ticket.unit_number ? `• Unit ${ticket.unit_number}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        ticket.state === 'new'
                          ? 'bg-emerald-50 text-emerald-700'
                          : ticket.state === 'in-progress'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {ticket.state === 'new'
                        ? 'New'
                        : ticket.state === 'in-progress'
                        ? 'In Progress'
                        : 'Completed'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
