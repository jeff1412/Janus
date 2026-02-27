const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listTickets() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('ticket_id, created_at, subject, sender_email')
        .order('created_at', { ascending: false })
        .limit(10);

    fs.writeFileSync('scripts/tickets-output.json', JSON.stringify(tickets, null, 2));
    console.log('Saved to scripts/tickets-output.json');
}

listTickets();
