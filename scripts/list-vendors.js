const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkVendors() {
    const { data: vendors, error } = await supabase
        .from('vendors')
        .select('*');

    if (error) {
        console.error('Error fetching vendors:', error);
        return;
    }

    console.log('--- VENDORS ---');
    vendors.forEach(v => {
        console.log(`ID: ${v.id}, Company: ${v.company_name}, Category: ${v.category}, Buildings: ${v.building_ids}`);
    });
}

checkVendors();
