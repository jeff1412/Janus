const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
    console.log('--- USERS ---');
    const { data: users } = await supabase.from('users').select('id, email, role, building_id, suite_number');
    console.table(users);

    console.log('\n--- BUILDINGS ---');
    const { data: buildings } = await supabase.from('buildings').select('id, name, property_manager_email');
    console.table(buildings);

    console.log('\n--- VENDORS ---');
    const { data: vendors } = await supabase.from('vendors').select('id, company_name, category, building_ids');
    console.table(vendors);
}

checkData();
