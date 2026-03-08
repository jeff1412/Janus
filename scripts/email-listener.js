const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('Could not find .env.local at:', envPath);
        return;
    }
    const envContent = fs.readFileSync(envPath, 'utf8');

    envContent.split('\n').forEach(line => {
        let l = line.trim();
        if (!l || l.startsWith('this is')) return;

        // Extract key and value from [KEY=VAL](mailto:...) or KEY=VAL
        let key, value;
        if (l.includes('=') && l.includes('](')) {
            // It's a markdown link [KEY=VAL](...)
            const match = l.match(/\[(.*?)=(.*?)\]/);
            if (match) {
                key = match[1].trim();
                value = match[2].trim();
            }
        } else if (l.includes('=')) {
            // Standard KEY=VAL
            const parts = l.split('=');
            key = parts[0].trim();
            value = parts.slice(1).join('=').trim();
        }

        if (key && value) {
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

const { createClient } = require('@supabase/supabase-js');

loadEnv();

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getLiveSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('is_default', true)
            .maybeSingle();

        if (settings && settings.username && settings.password) {
            console.log('--- Using Live Settings from Supabase Admin ---');
            return {
                user: settings.username,
                pass: settings.password,
                host: settings.host || 'imap.gmail.com'
            };
        }
    } catch (err) {
        console.warn('Could not fetch settings from Supabase, falling back to .env');
    }

    return {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        host: 'imap.gmail.com'
    };
}

async function listen() {
    const live = await getLiveSettings();

    if (!live.user || !live.pass) {
        console.error('Error: No email credentials found in Supabase or .env.local.');
        return;
    }

    console.log('--- JANUS Email Listener Started ---');
    console.log(`Monitoring: ${live.user}`);

    const config = {
        host: live.host,
        port: 993,
        secure: true,
        logger: false,
        auth: {
            user: live.user,
            pass: live.pass
        }
    };

    const client = new ImapFlow(config);

    // Prevent two simultaneous processing runs
    let isProcessing = false;

    // Process all unread emails one at a time
    async function processAllUnread() {
        if (isProcessing) {
            console.log('[LISTENER] Already processing, will check again shortly...');
            return;
        }
        isProcessing = true;
        try {
            const uids = await client.search({ unseen: true });
            if (!uids || uids.length === 0) {
                console.log('[LISTENER] No unread emails to process.');
                return;
            }
            console.log(`[LISTENER] Found ${uids.length} unread email(s). Processing one at a time...`);
            for (const uid of uids) {
                await processOneEmail(client, uid);
            }
            console.log('[LISTENER] Done processing unread emails.');
        } catch (err) {
            console.error('[LISTENER] Error in processAllUnread:', err.message);
        } finally {
            isProcessing = false;
        }
    }

    try {
        await client.connect();

        // Select INBOX
        let lock = await client.getMailboxLock('INBOX');
        try {
            console.log('Connected!');

            // On startup: process all existing unread emails one at a time
            await processAllUnread();

            // When a new email arrives, process all unread again (one at a time)
            client.on('exists', async (data) => {
                console.log(`[LISTENER] New mail detected (count: ${data.count}). Checking for unread...`);
                await processAllUnread();
            });

            // Keep alive
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('IMAP Error:', err);
    }
}

// Only process emails that arrived AFTER the listener started (UID > highestKnownUid)
async function processNewOnly(client, highestKnownUid) {
    try {
        const allUnseen = await client.search({ unseen: true });
        if (!allUnseen || allUnseen.length === 0) return highestKnownUid;

        // Filter to only truly new emails
        const newMessages = allUnseen.filter(uid => uid > highestKnownUid);
        if (newMessages.length === 0) {
            console.log('[LISTENER] No new emails above known UID. Skipping.');
            return highestKnownUid;
        }

        console.log(`[LISTENER] ${newMessages.length} new email(s) to process (UIDs: ${newMessages.join(', ')})`);

        let latestUid = highestKnownUid;
        for (let uid of newMessages) {
            await processOneEmail(client, uid);
            if (uid > latestUid) latestUid = uid;
        }

        return latestUid;
    } catch (err) {
        console.error('[LISTENER] Error in processNewOnly:', err);
        return highestKnownUid;
    }
}

// Cache of UIDs currently in progress to prevent double-firing
const activeUids = new Set();

async function processOneEmail(client, uid) {
    if (activeUids.has(uid)) {
        console.log(`[LISTENER] UID ${uid} is already being processed. Skipping.`);
        return;
    }
    activeUids.add(uid);
    try {
        const message = await client.fetchOne(uid, { source: true });
        if (!message || !message.source) {
            console.warn(`[LISTENER] No source for UID ${uid}`);
            return;
        }
        const parsed = await simpleParser(message.source);

        const fromEmail = parsed.from?.value?.[0]?.address;
        const subject = parsed.subject || '(No Subject)';
        const bodyText = (parsed.text || '').trim() || parsed.textAsHtml || parsed.html || '(No Body)';
        const messageId = parsed.messageId || `uid-${uid}-${parsed.date?.getTime() || 'stable'}`;

        console.log(`\n========================================`);
        console.log(`[LISTENER] UID: ${uid} | ID: ${messageId}`);
        console.log(`[LISTENER] From: ${fromEmail}`);
        console.log(`[LISTENER] Subject: ${subject}`);
        console.log(`[LISTENER] Body Preview: ${String(bodyText).substring(0, 120)}`);
        console.log(`========================================`);

        if (!fromEmail) {
            console.warn('[LISTENER] No fromEmail found, skipping.');
            await client.messageFlagsAdd(uid, ['\\Seen']);
            return;
        }

        // Call the email-intake API
        console.log(`[LISTENER] Calling email-intake API...`);
        let response, result;
        try {
            response = await fetch('http://localhost:3000/api/email-intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromEmail, subject, bodyText, messageId })
            });
            result = await response.json();
        } catch (fetchErr) {
            console.error('[LISTENER] Failed to reach API (is Next.js running on port 3000?):', fetchErr.message);
            return;
        }

        if (response.ok && result.ok) {
            console.log(`[LISTENER] SUCCESS. Ticket ID: ${result.ticketId || 'new'} | Follow-up: ${result.isFollowUp || false} | Reason: ${result.reason || 'n/a'}`);
        } else {
            console.error(`[LISTENER] FAILED. HTTP ${response.status}: ${JSON.stringify(result)}`);
        }

        // Always mark as seen so it isn't processed again
        await client.messageFlagsAdd(uid, ['\\Seen']);
        console.log(`[LISTENER] Marked UID ${uid} as Seen.`);
    } catch (err) {
        console.error(`[LISTENER] Error processing UID ${uid}:`, err.message);
    } finally {
        activeUids.delete(uid);
    }
}

listen().catch(console.error);
