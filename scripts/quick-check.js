const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLatestTicket() {
    process.stdout.write('Checking Supabase for latest ticket...\n');
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        process.stdout.write('Error: ' + JSON.stringify(error) + '\n');
        return;
    }

    if (tickets && tickets.length > 0) {
        const t = tickets[0];
        process.stdout.write('--- LATEST TICKET ---\n');
        process.stdout.write('ID: ' + t.ticket_id + '\n');
        process.stdout.write('Subject: ' + t.subject + '\n');
        process.stdout.write('Created At: ' + t.created_at + '\n');
        process.stdout.write('Damage Description: ' + (t.damage_description || 'NULL') + '\n');

        const { data: messages } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', t.ticket_id)
            .order('created_at', { ascending: true });

        process.stdout.write('\n--- FIRST MESSAGE CONTENT ---\n');
        if (messages && messages.length > 0) {
            process.stdout.write('Sender: ' + messages[0].sender_name + '\n');
            process.stdout.write('Body snippet: ' + messages[0].body.slice(0, 100).replace(/\n/g, ' ') + '...\n');
        } else {
            process.stdout.write('No messages found for this ticket.\n');
        }
    } else {
        process.stdout.write('No tickets found in database.\n');
    }
}

checkLatestTicket();
