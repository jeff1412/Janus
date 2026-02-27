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

    try {
        await client.connect();

        // Select INBOX
        let lock = await client.getMailboxLock('INBOX');
        try {
            console.log('Connected! Waiting for new emails...');

            // Initial check for UNSEEN
            await processUnseen(client);

            // Listen for changes
            client.on('exists', async (data) => {
                console.log(`New email detected (count: ${data.count}). Processing...`);
                await processUnseen(client);
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

async function processUnseen(client) {
    try {
        // Search for unseen messages
        const messages = await client.search({ unseen: true });

        if (messages.length === 0) return;

        console.log(`Processing ${messages.length} unseen messages...`);

        for (let uid of messages) {
            try {
                // Fetch message source
                const message = await client.fetchOne(uid, { source: true });
                const parsed = await simpleParser(message.source);

                const fromEmail = parsed.from?.value?.[0]?.address;
                const subject = parsed.subject || '(No Subject)';
                const bodyText = parsed.text || '(No Body)';

                if (!fromEmail) continue;

                console.log(`\n[NEW EMAIL]`);
                console.log(`From: ${fromEmail}`);
                console.log(`Subject: ${subject}`);

                // Call the local API
                const response = await fetch('http://localhost:3000/api/email-intake', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fromEmail, subject, bodyText })
                });

                const result = await response.json();
                if (result.ok) {
                    console.log(`Successfully ingested. Ticket ID: ${result.ticketId}`);
                } else {
                    console.error(`Ingestion failed: ${result.error}`);
                }

                // Mark as seen
                await client.messageFlagsAdd(uid, ['\\Seen']);
            } catch (err) {
                console.error('Error processing message UID:', uid, err);
            }
        }
    } catch (err) {
        console.error('Error listing unseen messages:', err);
    }
}

listen().catch(console.error);
