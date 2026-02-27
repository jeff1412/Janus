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
      toEmail,
      originalSubject,
      body,
      isInternal,
      senderEmail,
      senderName,
    } = await req.json()

    // Always insert into ticket_messages
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_email: senderEmail ?? null,
        sender_name: senderName ?? 'Property Manager',
        body,
        is_internal: isInternal,
      })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Only send email if NOT an internal note
    if (!isInternal && toEmail) {
      const subject = `Re: ${originalSubject} (Ticket ID: ${ticketId})`
      await sendEmail({
        to: toEmail,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <hr style="margin-top: 24px; border: none; border-top: 1px solid #e2e8f0;" />
            <p style="color: #94a3b8; font-size: 12px;">
              This message is regarding Ticket ID: <strong>${ticketId}</strong>.<br/>
              Please reply to this email to continue the conversation.
            </p>
          </div>
        `,
        text: body,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('send-reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
