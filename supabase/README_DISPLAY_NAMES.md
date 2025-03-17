# Display Name Update System

This directory contains SQL migrations to implement a comprehensive display name update system for the EventSnap app. These migrations ensure that when a user updates their display name in the profile settings, the change is reflected across all parts of the app.

## What These Migrations Do

1. `20250316190546_add_get_user_display_name_function.sql`: Creates an RPC function that retrieves a user's display name from the `auth.users` table.

2. `20250317010000_add_display_name_update_trigger.sql`: Adds triggers to automatically update display names in the `event_participants` and `events` tables whenever a user updates their display name in the `user` table.

3. `20250317020000_refresh_all_display_names.sql`: Creates a function to refresh all display names in the database and applies it to existing data.

## How to Apply These Migrations

### Option 1: Using the Supabase CLI

If you have the Supabase CLI set up and linked to your project:

```bash
supabase migration up
```

### Option 2: Using the Node.js Script

1. Make sure you have the required environment variables set in your `.env` file:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_KEY`: Your Supabase service role key (not the anon key)

2. Install the required dependencies:
   ```bash
   npm install @supabase/supabase-js dotenv
   ```

3. Run the script:
   ```bash
   node supabase/apply_migrations.js
   ```

### Option 3: Manual Application

You can also manually apply these migrations by:

1. Opening the Supabase SQL Editor
2. Copying the contents of each migration file
3. Executing them in order

## Verifying the Changes

After applying these migrations, you can verify that they're working by:

1. Updating a user's display name in the profile settings
2. Checking that the display name is updated in:
   - The events where the user is the creator
   - The event participants list
   - The gallery media items

## Troubleshooting

If display names are not updating correctly:

1. Check the browser console for any errors
2. Verify that the triggers are properly installed by querying:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%display_name%';
   ```
3. Manually run the refresh function:
   ```sql
   SELECT public.refresh_all_display_names();
   ``` 