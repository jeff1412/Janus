const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugData() {
    const { data: user } = await supabase
        .from('users')
        .select('email, building_id')
        .eq('email', 'hilarioeddiea08@gmail.com')
        .maybeSingle();

    console.log('User Building ID:', user?.building_id);

    const { data: building } = await supabase
        .from('buildings')
        .select('name, property_manager_email')
        .eq('id', user?.building_id || 0)
        .maybeSingle();

    console.log('Building PM Email:', building?.property_manager_email);

    const { data: tickets } = await supabase
        .from('tickets')
        .select('ticket_id, created_at, subject')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log('\n--- RECENT TICKETS ---');
    tickets?.forEach(t => console.log(`${t.created_at} | ${t.ticket_id} | ${t.subject}`));
}

debugData();
