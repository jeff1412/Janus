'use client';

import { mockTickets } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Send, Clock, MapPin, AlertCircle, User } from 'lucide-react';
import { useState } from 'react';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  
  const ticket = mockTickets.find((t) => t.id === ticketId);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState(ticket?.messages || []);

  if (!ticket) {
    return (
      <div className="p-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">Ticket not found</p>
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

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: `m${messages.length + 1}`,
      userId: '1',
      userName: 'You',
      userRole: 'admin' as const,
      timestamp: new Date(),
      content: newMessage,
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in-progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tickets">
          <Button variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-100">{ticket.title}</h1>
                    <p className="text-slate-400 text-sm mt-1">{ticket.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${getStatusColor(ticket.status)}`}>
                      {ticket.status === 'new' ? 'New' : ticket.status === 'in-progress' ? 'In Progress' : 'Completed'}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${getUrgencyColor(ticket.urgency)}`}>
                      {ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Description</h3>
                <p className="text-slate-400">{ticket.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Thread */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No messages yet. Start a conversation.</p>
              ) : (
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {message.userName.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-200">{message.userName}</span>
                          <span className="text-xs text-slate-500 capitalize">{message.userRole}</span>
                        </div>
                        <p className="text-sm text-slate-400 mb-1">{message.content}</p>
                        <p className="text-xs text-slate-600">
                          {message.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Input */}
              <div className="flex gap-2 pt-4 border-t border-slate-800">
                <Input
                  placeholder="Add a comment..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
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
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400">Status</label>
                <p className="text-slate-200 font-medium mt-1">
                  {ticket.status === 'new' ? 'New' : ticket.status === 'in-progress' ? 'In Progress' : 'Completed'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Urgency</label>
                <p className="text-slate-200 font-medium mt-1 capitalize">{ticket.urgency}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Location
                </label>
                <p className="text-slate-200 font-medium mt-1">{ticket.building}</p>
                <p className="text-slate-400 text-sm">Unit {ticket.unitNumber}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Assigned To
                </label>
                <p className="text-slate-200 font-medium mt-1">{ticket.assignedTo || 'Unassigned'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Created
                </label>
                <p className="text-slate-200 font-medium mt-1 text-sm">
                  {ticket.createdAt.toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                Update Status
              </Button>
              <Button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100">
                Reassign
              </Button>
              <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                Close Ticket
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
