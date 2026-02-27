const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLatestTicket() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (tickets && tickets.length > 0) {
        const t = tickets[0];
        console.log('--- LATEST TICKET ---');
        console.log('ID:', t.ticket_id);
        console.log('Created At:', t.created_at);
        console.log('Building ID:', t.building_id);

        const { data: messages } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', t.ticket_id)
            .order('created_at', { ascending: true });

        console.log('\n--- MESSAGES ---');
        messages?.forEach(m => {
            console.log(`[${m.sender_name}]: ${m.body}`);
        });
    } else {
        console.log('No tickets found.');
    }
}

checkLatestTicket();
