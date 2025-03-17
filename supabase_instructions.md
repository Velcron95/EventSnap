# Adding Background Image Support to Events Table

Follow these steps to add the `background_image` column to your events table in Supabase:

## Option 1: Using the Supabase Dashboard SQL Editor

1. Log in to your Supabase dashboard
2. Go to the SQL Editor tab
3. Create a new query
4. Copy and paste the following SQL:

```sql
-- Add background_image column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS background_image TEXT;

-- Update existing events with null background_image
UPDATE events SET background_image = NULL WHERE background_image IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'background_image';
```

5. Click "Run" to execute the query
6. You should see a result confirming the column was added

## Option 2: Using the Table Editor

1. Log in to your Supabase dashboard
2. Go to the "Table Editor" tab
3. Select the "events" table
4. Click on "Edit" or the pencil icon
5. Click "Add Column"
6. Enter the following details:
   - Name: `background_image`
   - Type: `text`
   - Default Value: leave empty
   - Is Nullable: Yes (checked)
7. Click "Save" to add the column

## Verifying the Change

After adding the column, you can verify it was added correctly by:

1. Going to the "Table Editor"
2. Selecting the "events" table
3. Checking that the `background_image` column appears in the table schema

## Testing in Your App

Once the column is added, your app should be able to:
1. Upload background images to Supabase storage
2. Store the image URL in the `background_image` column
3. Display the background image in the EventCard component

If you're still having issues after adding the column, check the console logs for any errors related to the background image upload or storage process. 