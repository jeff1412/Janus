import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { processEmail, escalateSelfHelpTicket } from '../../email-intake/route';
import nodemailer from 'nodemailer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

const geminiClient = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

async function getDynamicSmtpLocal(buildingId?: number | null) {
    try {
        const { data: settings } = await supabase
            .from('smtp_settings')
            .select('*')
            .or(buildingId ? `building_id.eq.${buildingId},is_default.eq.true` : 'is_default.eq.true')
            .order('building_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (settings) {
            return {
                transporter: nodemailer.createTransport({
                    host: settings.host,
                    port: settings.port,
                    secure: settings.secure,
                    auth: {
                        user: settings.username,
                        pass: settings.password,
                    },
                }),
                from: settings.from_email,
            };
        }
    } catch (err) {
        console.error('Error fetching dynamic SMTP in Self-Help:', err);
    }
    return null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    const action = searchParams.get('action'); // 'yes' or 'no'

    if (!ticketId || !action) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        // 1. Fetch original ticket details
        const { data: ticket, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('ticket_id', ticketId)
            .single();

        if (error || !ticket) {
            return new NextResponse('Ticket not found', { status: 404 });
        }

        // Double check it's still new/open
        if (ticket.state === 'completed' || ticket.state === 'cancelled') {
            return new NextResponse('<html><body><h1>This request is already resolved or cancelled.</h1></body></html>', { headers: { 'Content-Type': 'text/html' } });
        }

        if (action === 'yes') {
            // Create Instructions
            let instructionsText = 'We trust you can handle this! If you run into issues, simply reply to this email.';

            if (geminiClient) {
                try {
                    const model = geminiClient.getGenerativeModel({
                        model: 'gemini-1.5-flash',
                        safetySettings: [
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
                        ]
                    });

                    const issueDesc = ticket.damage_description || ticket.subject || 'Maintenance issue';
                    const prompt = `You are property management assistant JANUS. A resident wants to fix this issue themselves: "${issueDesc}". 
                    
Please generate a helpful, professional DIY repair guide with the following sections formatted in Markdown:

### 🛠️ What You Need
(List tools/parts)

### ⚠️ Safety First
(Safety warnings)

### 📝 Step-by-Step Instructions
(Max 5 steps).

End with: "If this does not fix the issue, please reply to this email to let us know, and we will send a professional."`;

                    const result = await model.generateContent(prompt);
                    const responseText = result.response.text();

                    if (responseText && responseText.length > 50) {
                        instructionsText = responseText;
                    } else {
                        throw new Error('AI response too short');
                    }
                } catch (err: any) {
                    console.error('[SELF-HELP] Gemini instruction generation failed:', err?.message || err);
                    const lowerCaseDesc = (ticket.damage_description || ticket.subject || '').toLowerCase();
                    if (lowerCaseDesc.includes('bulb') || lowerCaseDesc.includes('light')) {
                        instructionsText = `### 🛠️ What You Need\n- A replacement bulb\n- A sturdy ladder\n\n### ⚠️ Safety First\n- **ENSURE THE LIGHT SWITCH IS OFF.**\n- Wait for it to cool.\n\n### 📝 Instructions\n1. Set up ladder.\n2. Unscrew old bulb.\n3. Screw in new bulb.\n4. Test.\n\nIf this does not fix the issue, please reply to this email to let us know, and we will send a professional.`;
                    } else {
                        instructionsText = `We noticed you're ready to handle this repair yourself!\n\nPlease ensure you have the necessary safety gear and tools ready. If this is an electrical replacement, ensure the power is off first.\n\nIf this does not fix the issue, please reply to this email to let us know, and we will send a professional.`;
                    }
                }
            } else {
                console.error('[SELF-HELP] GEMINI_API_KEY is not set.');
            }

            // Update state to in-progress
            await supabase.from('tickets').update({ state: 'in-progress' }).eq('ticket_id', ticketId);

            // Send instructions email
            const smtp = await getDynamicSmtpLocal(ticket.building_id);

            const emailBody = `Hi ${ticket.resident_name || ticket.resident || ''},\n\nWe are glad you are taking care of this yourself!\n\nHere are some instructions that might help:\n${instructionsText}\n\nBest regards,\nJANUS System`;

            if (smtp?.transporter) {
                await smtp.transporter.sendMail({
                    from: smtp.from,
                    to: ticket.sender_email,
                    subject: `Ticket ${ticketId} - Self-Help Instructions: ${ticket.subject}`,
                    text: emailBody
                });
            }

            // Log in ticket history
            await supabase.from('ticket_messages').insert({
                ticket_id: ticketId,
                sender_email: 'system@janus',
                sender_name: 'JANUS System',
                body: `Resident accepted Self-Help. Instructions sent:\n\n${instructionsText}`,
                is_internal: false
            });

            return new NextResponse(
                `<html>
          <body style="font-family:sans-serif; text-align:center; padding-top: 50px;">
            <h1 style="color: #4CAF50;">Awesome! 🛠️</h1>
            <p>We've sent the step-by-step instructions to your email (${ticket.sender_email}).</p>
            <p>If you get stuck, just reply to that email!</p>
          </body>
        </html>`,
                { headers: { 'Content-Type': 'text/html' } }
            );
        }
        else if (action === 'no') {
            // Resident rejected Self-Help -> Escalate to normal ticket
            await escalateSelfHelpTicket({
                ticketId: ticketId,
                reason: 'Resident declined Self-Help option. Escalating request to maintenance professional.'
            });

            return new NextResponse(
                `<html>
                <body style="font-family:sans-serif; text-align:center; padding-top: 50px;">
            <h1 style="color: #2196F3;">No problem! 👷‍♂️</h1>
            <p>We've created a new standard maintenance request for you.</p>
            <p>A professional vendor has been notified and you will receive a confirmation email shortly.</p>
            </body>
            </html>`,
                { headers: { 'Content-Type': 'text/html' } }
            );
        }

        return new NextResponse('Invalid action', { status: 400 });
    } catch (error) {
        console.error('Self-help action error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
