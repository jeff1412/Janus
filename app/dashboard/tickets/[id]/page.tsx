'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Send,
  Clock,
  MapPin,
  User,
  Tag,
  Wrench,
  Lock,
  MessageSquare,
} from 'lucide-react';
import type {
  Ticket,
  TicketMessage,
  TicketState,
  TicketType,
  TicketUrgency,
  Vendor,
} from '@/types';
import { useAuthUser } from '@/app/hooks/useAuthUser';

export default function TicketDetailPage() {
  const params = useParams();
  const routeId = params.id as string;

  const { user } = useAuthUser();
  const isManager = user?.role === 'PropertyManager';

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [updatingState, setUpdatingState] = useState(false);
  const [updatingVendor, setUpdatingVendor] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);
  const [updatingUrgency, setUpdatingUrgency] = useState(false);
  const [updatingEstimate, setUpdatingEstimate] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('ticket_id', routeId)
        .maybeSingle();

      if (!ticketError && ticketData) {
        setTicket(ticketData as Ticket);
      } else {
        console.error('Error loading ticket', ticketError);
      }

      const { data: msgData, error: msgError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!msgError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .order('company_name', { ascending: true });

      if (vendorData) {
        setVendors(vendorData as Vendor[]);
      }

      setLoading(false);
    };

    fetchAll();
  }, [routeId]);

  useEffect(() => {
    if (!isManager && isInternal) {
      setIsInternal(false);
    }
  }, [isManager, isInternal]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket) return;
    setSending(true);

    const isInternalNote = isManager ? isInternal : false;
    const body = newMessage.trim();

    try {
      // 1) Insert into ticket_messages from CLIENT (respects RLS when enabled)
      const { error: insertError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: routeId,
          sender_name: user?.name ?? 'Property Manager',
          sender_email: user?.email ?? null,
          body,
          is_internal: isInternalNote,
        });

      if (insertError) {
        console.error('Error sending message', insertError);
        setSending(false);
        return;
      }

      // 2) If it's an external reply, call API to send email
      if (!isInternalNote) {
        const payload = {
          ticketId: routeId,
          toEmail: ticket.resident ?? ticket.sender_email,
          originalSubject:
            ticket.subject ??
            ticket.damage_description ??
            `Ticket ${ticket.ticket_id}`,
          body,
          isInternal: isInternalNote,
        };

        const res = await fetch('/api/send-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('Error sending email', data.error || res.statusText);
        }
      }

      // 3) Refetch messages so we see the new one
      const { data: msgData, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!fetchError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }

      setNewMessage('');
    } catch (err) {
      console.error('Error in handleSendMessage', err);
    } finally {
      setSending(false);
    }
  };

  const handleStateChange = async (newState: TicketState) => {
    if (!ticket || !isManager) return;
    setUpdatingState(true);

    const previousState = ticket.state;

    const { error } = await supabase
      .from('tickets')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('ticket_id', routeId);

    if (!error) {
      setTicket({ ...ticket, state: newState });

      // Log system message about the change
      await supabase.from('ticket_messages').insert({
        ticket_id: routeId,
        sender_name: 'System',
        sender_email: 'system@janus',
        body: `System: PM changed status from ${previousState} to ${newState}.`,
        is_internal: true,
      });

      // Refresh messages so the system note appears
      const { data: msgData, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!fetchError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }
    } else {
      console.error('Error updating state', error);
    }
    setUpdatingState(false);
  };

  const handleVendorChange = async (vendorId: string) => {
    if (!ticket || !isManager) return;
    setUpdatingVendor(true);

    const previousVendorId = ticket.assigned_vendor_id;

    const id = vendorId === 'none' ? null : Number(vendorId);

    // Update ticket in Supabase
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_vendor_id: id, updated_at: new Date().toISOString() })
      .eq('ticket_id', routeId);

    if (error) {
      console.error('Error assigning vendor', error);
      setUpdatingVendor(false);
      return;
    }

    const updatedTicket: Ticket = { ...ticket, assigned_vendor_id: id };
    setTicket(updatedTicket);

    // Log system message about vendor assignment change
    const previousVendor = vendors.find((v) => v.id === previousVendorId);
    const newVendor = vendors.find((v) => v.id === id);

    await supabase.from('ticket_messages').insert({
      ticket_id: routeId,
      sender_name: 'System',
      sender_email: 'system@janus',
      body: `System: PM reassigned vendor from ${
        previousVendor ? previousVendor.company_name : 'None'
      } to ${newVendor ? newVendor.company_name : 'None'}.`,
      is_internal: true,
    });

    // If a real vendor was selected, notify them via API route
    if (id) {
      const vendor = vendors.find((v) => v.id === id);
      try {
        const res = await fetch('/api/notify-vendor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: routeId,
            vendorEmail: vendor?.email ?? null,
            vendorName: vendor?.company_name ?? 'Vendor',
            repairCategory: updatedTicket.repair_category,
            urgency: updatedTicket.urgency,
            damageDescription: updatedTicket.damage_description,
            buildingName: updatedTicket.building,
            residentName: updatedTicket.resident,
            suiteNumber: updatedTicket.unit_number,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error(
            'Error notifying vendor',
            data.error || res.statusText
          );
        } else {
          // Refetch messages to include system message
          const { data: msgData, error: msgError } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', routeId)
            .order('created_at', { ascending: true });

          if (!msgError && msgData) {
            setMessages(msgData as TicketMessage[]);
          }

          // Also update ticket state locally to in-progress
          setTicket((prev) =>
            prev ? { ...prev, state: 'in-progress' } : prev
          );
        }
      } catch (err) {
        console.error('Error notifying vendor', err);
      }
    }

    setUpdatingVendor(false);
  };

  const getStatusColor = (status: TicketState) => {
    switch (status) {
      case 'new':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'in-progress':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'completed':
        return 'bg-green-50 text-green-600 border-green-200';
      case 'pending-approval':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getStatusLabel = (status: TicketState) => {
    switch (status) {
      case 'new':
        return 'New';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'pending-approval':
        return 'Pending Approval';
      default:
        return status;
    }
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

  const getTypeLabel = (type: TicketType) => {
    switch (type) {
      case 'repair':
        return 'Repair';
      case 'complaint':
        return 'Complaint';
      case 'condo_reject':
        return 'Owner Responsibility';
      case 'general_inquiries_or_redesign':
        return 'General Inquiry';
    }
  };

  const handleTypeOverride = async (newType: TicketType) => {
    if (!ticket || !isManager || newType === ticket.type) return;
    setUpdatingType(true);

    const previousType = ticket.type;

    const { error } = await supabase
      .from('tickets')
      .update({ type: newType, updated_at: new Date().toISOString() })
      .eq('ticket_id', routeId);

    if (!error) {
      setTicket({ ...ticket, type: newType });

      await supabase.from('ticket_messages').insert({
        ticket_id: routeId,
        sender_name: 'System',
        sender_email: 'system@janus',
        body: `System: PM changed type from ${previousType} to ${newType}.`,
        is_internal: true,
      });

      const { data: msgData, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!fetchError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }
    } else {
      console.error('Error updating type', error);
    }

    setUpdatingType(false);
  };

  const handleUrgencyOverride = async (newUrgency: TicketUrgency) => {
    if (!ticket || !isManager || newUrgency === ticket.urgency) return;
    setUpdatingUrgency(true);

    const previousUrgency = ticket.urgency;

    const { error } = await supabase
      .from('tickets')
      .update({ urgency: newUrgency, updated_at: new Date().toISOString() })
      .eq('ticket_id', routeId);

    if (!error) {
      setTicket({ ...ticket, urgency: newUrgency });

      await supabase.from('ticket_messages').insert({
        ticket_id: routeId,
        sender_name: 'System',
        sender_email: 'system@janus',
        body: `System: PM changed urgency from ${previousUrgency} to ${newUrgency}.`,
        is_internal: true,
      });

      const { data: msgData, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!fetchError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }
    } else {
      console.error('Error updating urgency', error);
    }

    setUpdatingUrgency(false);
  };

  const handleEstimateOverride = async (value: string) => {
    if (!ticket || !isManager) return;
    setUpdatingEstimate(true);

    const trimmed = value.trim();
    const previousEstimate = ticket.estimated_cost ?? null;

    const newEstimate =
      trimmed === '' || Number.isNaN(Number(trimmed))
        ? null
        : Number(trimmed);

    const { error } = await supabase
      .from('tickets')
      .update({
        estimated_cost: newEstimate,
        updated_at: new Date().toISOString(),
      })
      .eq('ticket_id', routeId);

    if (!error) {
      setTicket({ ...ticket, estimated_cost: newEstimate ?? undefined });

      await supabase.from('ticket_messages').insert({
        ticket_id: routeId,
        sender_name: 'System',
        sender_email: 'system@janus',
        body: `System: PM changed estimated cost from ${
          previousEstimate != null ? `$${previousEstimate}` : 'none'
        } to ${newEstimate != null ? `$${newEstimate}` : 'none'}.`,
        is_internal: true,
      });

      const { data: msgData, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', routeId)
        .order('created_at', { ascending: true });

      if (!fetchError && msgData) {
        setMessages(msgData as TicketMessage[]);
      }
    } else {
      console.error('Error updating estimated cost', error);
    }

    setUpdatingEstimate(false);
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
              <Button className="mt-4 bg-[#3EB489] hover:bg-[#36a27b] text-white">
                Back to Tickets
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignedVendor = vendors.find((v) => v.id === ticket.assigned_vendor_id);

  return (
    <div className="p-8 space-y-8">
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
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {ticket.subject ??
                      ticket.damage_description ??
                      'Untitled Ticket'}
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    {ticket.ticket_id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {ticket.type && (
                    <span className="text-xs px-3 py-1 rounded-full font-medium border bg-blue-50 text-blue-700 border-blue-200">
                      {getTypeLabel(ticket.type)}
                    </span>
                  )}
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium border ${getStatusColor(
                      ticket.state
                    )}`}
                  >
                    {getStatusLabel(ticket.state)}
                  </span>
                  {ticket.urgency && (
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium border ${getUrgencyColor(
                        ticket.urgency
                      )}`}
                    >
                      {ticket.urgency.charAt(0).toUpperCase() +
                        ticket.urgency.slice(1)}{' '}
                      Priority
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.damage_description && (
                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-2">
                    Description
                  </h3>
                  <p className="text-slate-600 whitespace-pre-wrap">
                    {ticket.damage_description}
                  </p>
                </div>
              )}

              {ticket.repair_category && (
                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1 flex items-center gap-1">
                    <Wrench className="w-4 h-4" />
                    Repair Category
                  </h3>
                  <p className="text-slate-600 capitalize">
                    {ticket.repair_category}
                  </p>
                </div>
              )}

              {(ticket.sender_email || ticket.resident) && (
                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Submitted By
                  </h3>
                  <p className="text-slate-600">
                    {ticket.resident ?? ticket.sender_email}
                    {ticket.sender_email && ticket.resident && (
                      <span className="text-slate-400 text-sm ml-2">
                        ({ticket.sender_email})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No messages yet. Add a note below.
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 p-3 rounded-lg ${
                        message.is_internal
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#3EB489] flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {(
                              message.sender_name ??
                              message.sender_email ??
                              '?'
                            )
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 text-sm">
                            {message.sender_name ??
                              message.sender_email ??
                              'Unknown'}
                          </span>
                          {message.is_internal && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Internal Note
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {message.body}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 space-y-3">
                {isManager && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInternal(!isInternal)}
                      className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full border transition-colors ${
                        isInternal
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      {isInternal ? 'Internal Note' : 'Mark as Internal Note'}
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder={
                      isManager && isInternal
                        ? 'Add an internal note (only staff can see this)...'
                        : 'Add a comment...'
                    }
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 resize-none"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="bg-[#3EB489] hover:bg-[#36a27b] text-white gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Type
                </label>
                {isManager ? (
                  <select
                    disabled={updatingType}
                    value={ticket.type}
                    onChange={(e) =>
                      handleTypeOverride(e.target.value as TicketType)
                    }
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3EB489]"
                  >
                    <option value="repair">Repair</option>
                    <option value="complaint">Complaint</option>
                    <option value="condo_reject">Owner Responsibility</option>
                    <option value="general_inquiries_or_redesign">
                      General Inquiry
                    </option>
                  </select>
                ) : (
                  <p className="text-slate-900 font-medium mt-1">
                    {ticket.type ? getTypeLabel(ticket.type) : '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Urgency
                </label>
                {isManager ? (
                  <select
                    disabled={updatingUrgency}
                    value={ticket.urgency ?? ''}
                    onChange={(e) =>
                      handleUrgencyOverride(e.target.value as TicketUrgency)
                    }
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3EB489]"
                  >
                    <option value="">—</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                ) : (
                  <p className="text-slate-900 font-medium mt-1 capitalize">
                    {ticket.urgency ?? '—'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">
                  Estimated Cost
                </label>
                {isManager ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={
                      ticket.estimated_cost != null
                        ? ticket.estimated_cost
                        : ''
                    }
                    onBlur={(e) => handleEstimateOverride(e.target.value)}
                    disabled={updatingEstimate}
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3EB489]"
                    placeholder="Enter estimated cost"
                  />
                ) : (
                  <p className="text-slate-900 font-medium mt-1">
                    {ticket.estimated_cost != null
                      ? `$${ticket.estimated_cost}`
                      : '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
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
                  <Clock className="w-3 h-3" />
                  Created
                </label>
                <p className="text-slate-900 font-medium mt-1 text-sm">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {isManager && (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(
                  ['new', 'in-progress', 'completed', 'pending-approval'] as TicketState[]
                ).map((s) => (
                  <Button
                    key={s}
                    onClick={() => handleStateChange(s)}
                    disabled={updatingState || ticket.state === s}
                    variant={ticket.state === s ? 'default' : 'outline'}
                    className={`w-full text-sm ${
                      ticket.state === s
                        ? 'bg-[#3EB489] hover:bg-[#36a27b] text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {getStatusLabel(s)}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {isManager && (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Assign Vendor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const matchedVendors = vendors.filter((v) => {
                    const categoryMatch =
                      !ticket.repair_category || !v.category
                        ? true
                        : v.category.toLowerCase() ===
                          ticket.repair_category?.toLowerCase();

                    const buildingMatch =
                      !ticket.building_id || !v.building_ids
                        ? true
                        : v.building_ids
                            .split(',')
                            .map((id) => id.trim())
                            .includes(String(ticket.building_id));

                    return categoryMatch && buildingMatch;
                  });

                  const otherVendors = vendors.filter(
                    (v) => !matchedVendors.includes(v)
                  );

                  const currentValue =
                    ticket.assigned_vendor_id?.toString() ?? 'none';

                  return (
                    <>
                      <select
                        value={currentValue}
                        onChange={(e) => handleVendorChange(e.target.value)}
                        disabled={updatingVendor}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3EB489]"
                      >
                        <option value="none">Unassigned</option>

                        {matchedVendors.length > 0 && (
                          <optgroup label="Recommended vendors">
                            {matchedVendors.map((v) => (
                              <option key={v.id} value={v.id.toString()}>
                                {v.company_name}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {otherVendors.length > 0 && (
                          <optgroup label="Other vendors">
                            {otherVendors.map((v) => (
                              <option key={v.id} value={v.id.toString()}>
                                {v.company_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      {assignedVendor && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                          <p className="font-medium text-slate-900">
                            {assignedVendor.company_name}
                          </p>
                          {assignedVendor.email && (
                            <p className="text-slate-500">
                              {assignedVendor.email}
                            </p>
                          )}
                          {assignedVendor.phone && (
                            <p className="text-slate-500">
                              {assignedVendor.phone}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
