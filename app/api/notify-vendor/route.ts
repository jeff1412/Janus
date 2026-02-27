import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/mailer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const {
      ticketId,
      vendorEmail,
      vendorName,
      repairCategory,
      urgency,
      damageDescription,
      buildingName,
      residentName,
      suiteNumber,
    } = await req.json()

    // Send work order email to vendor
    if (vendorEmail) {
      const subject = `Work Order: ${repairCategory ?? 'General'} (Ticket ID: ${ticketId})`
      await sendEmail({
        to: vendorEmail,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">New Work Order Assignment</h2>
            <p>You have been assigned a new repair job. Please review the details below.</p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; font-weight: bold; color: #475569; width: 40%;">Ticket ID</td>
                <td style="padding: 10px; color: #1e293b;">${ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #475569;">Category</td>
                <td style="padding: 10px; color: #1e293b;">${repairCategory ?? '—'}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; font-weight: bold; color: #475569;">Urgency</td>
                <td style="padding: 10px; color: #1e293b; text-transform: capitalize;">${urgency ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #475569;">Building</td>
                <td style="padding: 10px; color: #1e293b;">${buildingName ?? '—'}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; font-weight: bold; color: #475569;">Unit / Suite</td>
                <td style="padding: 10px; color: #1e293b;">${suiteNumber ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #475569;">Resident</td>
                <td style="padding: 10px; color: #1e293b;">${residentName ?? '—'}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; font-weight: bold; color: #475569;">Description</td>
                <td style="padding: 10px; color: #1e293b;">${damageDescription ?? '—'}</td>
              </tr>
            </table>

            <hr style="margin-top: 24px; border: none; border-top: 1px solid #e2e8f0;" />
            <p style="color: #94a3b8; font-size: 12px;">
              Please reply to this email to communicate updates regarding Ticket ID: <strong>${ticketId}</strong>.
            </p>
          </div>
        `,
        text: `
Work Order: ${ticketId}
Category: ${repairCategory ?? '—'}
Urgency: ${urgency ?? '—'}
Building: ${buildingName ?? '—'}
Unit: ${suiteNumber ?? '—'}
Resident: ${residentName ?? '—'}
Description: ${damageDescription ?? '—'}
        `.trim(),
      })
    }

    // Log system message in ticket_messages
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_email: 'system',
        sender_name: 'System',
        body: `Vendor "${vendorName}" has been assigned to this ticket.`,
        is_internal: true,
      })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Update ticket state to in-progress
    const { error: ticketError } = await supabase
      .from('tickets')
      .update({ state: 'in-progress', updated_at: new Date().toISOString() })
      .eq('ticket_id', ticketId)

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('notify-vendor error:', error)
    return NextResponse.json({ error: 'Failed to notify vendor' }, { status: 500 })
  }
}
