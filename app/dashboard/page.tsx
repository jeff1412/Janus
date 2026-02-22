'use client';

import { mockTickets } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const stats = [
    {
      title: 'Urgent Tickets',
      value: mockTickets.filter(t => t.urgency === 'high').length,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'In Progress',
      value: mockTickets.filter(t => t.status === 'in-progress').length,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Completed',
      value: mockTickets.filter(t => t.status === 'completed').length,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Tickets',
      value: mockTickets.length,
      icon: AlertCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  const recentTickets = mockTickets.slice(0, 5);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome to JANUS Property Management</p>
        </div>
        <Link href="/tickets">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
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
            <Card key={stat.title} className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-100">{stat.value}</div>
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
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100">Recent Tickets</CardTitle>
            <Link href="/tickets">
              <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-slate-800">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block p-4 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-100">{ticket.title}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          ticket.urgency === 'high'
                            ? 'bg-red-500/10 text-red-400'
                            : ticket.urgency === 'medium'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}
                      >
                        {ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {ticket.building} • Unit {ticket.unitNumber}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      ticket.status === 'new'
                        ? 'bg-blue-500/10 text-blue-400'
                        : ticket.status === 'in-progress'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-green-500/10 text-green-400'
                    }`}
                  >
                    {ticket.status === 'new'
                      ? 'New'
                      : ticket.status === 'in-progress'
                      ? 'In Progress'
                      : 'Completed'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
