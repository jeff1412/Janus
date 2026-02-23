'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Send,
  Clock,
  MapPin,
  User,
} from 'lucide-react';

type TicketStatus = 'new' | 'in-progress' | 'completed' | 'escalated' | 'pending-approval';
type TicketUrgency = 'low' | 'medium' | 'high';

interface Ticket {
  id: string;
  ticket_id: string;
  state: TicketStatus;
  type: string | null;
  urgency: TicketUrgency | null;
  building: string | null;
  unit_number: string | null;
  created_at: string;
  description?: string | null;
  assignedTo?: string | null;
}

interface Message {
  id: string;
  userId: string;
  userName: string;
  userRole: 'admin' | 'staff' | 'resident';
  timestamp: Date;
  content: string;
}

export default function TicketDetailPage() {
  const params = useParams();
  const routeId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('ticket_id', routeId)
        .maybeSingle();

      if (!error && data) {
        setTicket(data as Ticket);
      } else {
        console.error('Error loading ticket', error);
      }
      setLoading(false);
    };

    fetchTicket();
  }, [routeId]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `m${messages.length + 1}`,
      userId: '1',
      userName: 'You',
      userRole: 'admin',
      timestamp: new Date(),
      content: newMessage,
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const getUrgencyColor = (urgency?: string | null) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'low':
        return 'bg-green-50 text-green-600 border-green-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
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

  if (loading) {
    return (
      <div className="p-8">
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Loading ticket...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8">
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Ticket not found</p>
            <Link href="/dashboard/tickets">
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                Back to Tickets
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">
                      {ticket.type ?? 'Ticket'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                      {ticket.ticket_id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium border ${getStatusColor(
                        ticket.state
                      )}`}
                    >
                      {ticket.state === 'new'
                        ? 'New'
                        : ticket.state === 'in-progress'
                        ? 'In Progress'
                        : 'Completed'}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium border ${getUrgencyColor(
                        ticket.urgency
                      )}`}
                    >
                      {ticket.urgency
                        ? ticket.urgency.charAt(0).toUpperCase() +
                          ticket.urgency.slice(1)
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Description
                </h3>
                <p className="text-slate-600">
                  {ticket.description ?? 'No description provided.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Thread */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No messages yet. Start a conversation.
                </p>
              ) : (
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {message.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">
                            {message.userName}
                          </span>
                          <span className="text-xs text-slate-500 capitalize">
                            {message.userRole}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                          {message.content}
                        </p>
                        <p className="text-xs text-slate-500">
                          {message.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Input */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <Input
                  placeholder="Add a comment..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Status
                </label>
                <p className="text-slate-900 font-medium mt-1">
                  {ticket.state === 'new'
                    ? 'New'
                    : ticket.state === 'in-progress'
                    ? 'In Progress'
                    : 'Completed'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Urgency
                </label>
                <p className="text-slate-900 font-medium mt-1 capitalize">
                  {ticket.urgency ?? 'unknown'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Location
                </label>
                <p className="text-slate-900 font-medium mt-1">
                  {ticket.building ?? 'Unknown building'}
                </p>
                <p className="text-slate-600 text-sm">
                  Unit {ticket.unit_number ?? '—'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Assigned To
                </label>
                <p className="text-slate-900 font-medium mt-1">
                  {ticket.assignedTo || 'Unassigned'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Created
                </label>
                <p className="text-slate-900 font-medium mt-1 text-sm">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                Update Status
              </Button>
              <Button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100">
                Reassign
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Close Ticket
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
