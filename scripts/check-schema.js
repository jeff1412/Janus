const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./load-env');

loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    const { data: buildings } = await supabase.from('buildings').select('*').limit(1);
    console.log('\n--- BUILDING SCHEMA ---');
    if (buildings && buildings.length > 0) {
        console.log(JSON.stringify(Object.keys(buildings[0]), null, 2));
    }
}

checkSchema();
