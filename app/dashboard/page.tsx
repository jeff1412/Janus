'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Wrench,
  MessageSquare,
  Building,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Ticket, TicketState, TicketType } from '@/types';

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);

      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true });

      if (count !== null) setTotalCount(count);

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

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
  const newCount = tickets.filter((t) => t.state === 'new').length;

  const repairCount = tickets.filter((t) => t.type === 'repair').length;
  const complaintCount = tickets.filter((t) => t.type === 'complaint').length;
  const condoRejectCount = tickets.filter((t) => t.type === 'condo_reject').length;
  const generalCount = tickets.filter((t) => t.type === 'general_inquiries_or_redesign').length;

  const getStateLabel = (state: TicketState) => {
    switch (state) {
      case 'new':
        return 'New';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'pending-approval':
        return 'Pending Approval';
      default:
        return state;
    }
  };

  const getStateColor = (state: TicketState) => {
    switch (state) {
      case 'new':
        return 'bg-blue-50 text-blue-600';
      case 'in-progress':
        return 'bg-amber-50 text-amber-600';
      case 'completed':
        return 'bg-green-50 text-green-600';
      case 'pending-approval':
        return 'bg-purple-50 text-purple-600';
      default:
        return 'bg-slate-50 text-slate-500';
    }
  };

  const getTypeLabel = (type: TicketType) => {
    switch (type) {
      case 'repair':
        return 'Repair';
      case 'complaint':
        return 'Complaint';
      case 'condo_reject':
        return 'Owner Responsibility';
      case 'general_inquiries_or_redesign':
        return 'General';
    }
  };

  const getTypeColor = (type: TicketType) => {
    switch (type) {
      case 'repair':
        return 'bg-blue-50 text-blue-700';
      case 'complaint':
        return 'bg-red-50 text-red-700';
      case 'condo_reject':
        return 'bg-orange-50 text-orange-700';
      case 'general_inquiries_or_redesign':
        return 'bg-slate-50 text-slate-600';
    }
  };

  const statusStats = [
    {
      title: 'Urgent Tickets',
      value: urgentCount,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      sub: 'Require immediate attention',
    },
    {
      title: 'New',
      value: newCount,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      sub: 'Awaiting action',
    },
    {
      title: 'In Progress',
      value: inProgressCount,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      sub: 'Currently being worked on',
    },
    {
      title: 'Completed',
      value: completedCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      sub: 'Resolved tickets',
    },
    {
      title: 'Total Tickets',
      value: totalCount,
      icon: Building,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      sub: 'All time in the system',
    },
  ];

  const typeStats = [
    {
      title: 'Repairs',
      value: repairCount,
      icon: Wrench,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Complaints',
      value: complaintCount,
      icon: MessageSquare,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Owner Responsibility',
      value: condoRejectCount,
      icon: Building,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'General Inquiries',
      value: generalCount,
      icon: HelpCircle,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
  ];

  const recentTickets = tickets.slice(0, 5);

  return (
    <div className="p-8 space-y-8">
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

      {/* Status Stats */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wide">
          By Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statusStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="bg-white border border-slate-200 shadow-sm"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-slate-700">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {loading ? '—' : stat.value}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Type Stats */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wide">
          By Type
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {typeStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="bg-white border border-slate-200 shadow-sm"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-slate-700">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {loading ? '—' : stat.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.ticket_id}`}
                  className="block p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {ticket.subject ??
                            ticket.damage_description ??
                            'Untitled Ticket'}
                        </h3>
                        {ticket.type && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getTypeColor(
                              ticket.type
                            )}`}
                          >
                            {getTypeLabel(ticket.type)}
                          </span>
                        )}
                        {ticket.urgency === 'high' && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600 flex-shrink-0">
                            High Priority
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {ticket.ticket_id}
                        {ticket.building ? ` • ${ticket.building}` : ''}
                        {ticket.unit_number ? ` • Unit ${ticket.unit_number}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${getStateColor(
                        ticket.state
                      )}`}
                    >
                      {getStateLabel(ticket.state)}
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
