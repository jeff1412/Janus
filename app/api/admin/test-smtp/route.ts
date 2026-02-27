import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { host, port, username, password, fromName, fromEmail } = await req.json();

        if (!host || !port || !username || !password) {
            return NextResponse.json(
                { error: 'Missing required SMTP configuration' },
                { status: 400 }
            );
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: username,
                pass: password,
            },
        });

        const finalFrom = `"${fromName || 'JANUS Test'}" <${fromEmail || username}>`;

        await transporter.sendMail({
            from: finalFrom,
            to: username, // Send test to the user themselves
            subject: 'JANUS SMTP Test Connection',
            text: `Congratulations! Your SMTP connection for JANUS is working correctly.\n\nHost: ${host}\nPort: ${port}\nUser: ${username}\n\nThis is an automated test email.`,
            html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">JANUS SMTP Connection Test</h2>
          <p>Congratulations! Your SMTP connection for <strong>JANUS</strong> is working correctly.</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Host:</strong> ${host}</p>
            <p style="margin: 5px 0;"><strong>Port:</strong> ${port}</p>
            <p style="margin: 5px 0;"><strong>User:</strong> ${username}</p>
          </div>
          <p>This is an automated test email. You can now use these credentials to send ticket notifications.</p>
        </div>
      `,
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('SMTP Test Error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to connect to SMTP server' },
            { status: 500 }
        );
    }
}
