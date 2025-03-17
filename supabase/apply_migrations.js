const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// List of migrations to apply
const migrations = [
  '20250316190546_add_get_user_display_name_function.sql',
  '20250317010000_add_display_name_update_trigger.sql',
  '20250317020000_refresh_all_display_names.sql'
];

async function applyMigrations() {
  console.log('Starting migration process...');
  
  for (const migrationFile of migrations) {
    try {
      console.log(`Applying migration: ${migrationFile}`);
      
      // Read the SQL file
      const filePath = path.join(__dirname, 'migrations', migrationFile);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`Error applying migration ${migrationFile}:`, error);
      } else {
        console.log(`Successfully applied migration: ${migrationFile}`);
      }
    } catch (err) {
      console.error(`Error processing migration ${migrationFile}:`, err);
    }
  }
  
  console.log('Migration process completed');
}

// Run the migrations
applyMigrations().catch(err => {
  console.error('Migration process failed:', err);
  process.exit(1);
}); 