import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';
import { processEmail } from '../../email-intake/route';
import { simpleParser } from 'mailparser';

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

export async function POST(req: Request) {
    try {
        const { data: settings } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('is_default', true)
            .maybeSingle();

        if (!settings) {
            return NextResponse.json({ error: 'No default SMTP/IMAP settings found' }, { status: 400 });
        }

        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: {
                user: settings.username,
                pass: settings.password,
            },
            logger: false,
        });

        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        const messagesProcessed = [];
        try {
            // search for unread messages
            const uids = await client.search({ seen: false });

            if (uids && Array.isArray(uids)) {
                for (const uid of uids) {
                    const message = await client.fetchOne(String(uid), { source: true });
                    if (message && message.source) {
                        const parsed = await simpleParser(message.source);
                        const fromEmail = parsed.from?.value[0]?.address;
                        const subject = parsed.subject || '(No Subject)';
                        const bodyText = parsed.text || '(No Body)';

                        if (fromEmail) {
                            const result = await processEmail({
                                fromEmail,
                                subject,
                                bodyText
                            });

                            messagesProcessed.push({
                                uid,
                                from: fromEmail,
                                subject,
                                result
                            });
                        }
                        // Mark as seen regardless of processing result to avoid infinite loops on bad emails
                        await client.messageFlagsAdd(String(uid), ['\\Seen']);
                    }
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();

        return NextResponse.json({
            ok: true,
            processedCount: messagesProcessed.length,
            details: messagesProcessed
        });
    } catch (err: any) {
        console.error('IMAP Sync Error:', err);
        return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
    }
}
