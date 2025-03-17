# Setting Up Storage for Event Background Images

Your app is trying to upload background images to a storage bucket named `media`, but it might not exist or have the correct permissions. Follow these steps to set up storage properly:

## 1. Create the Media Storage Bucket

1. Log in to your Supabase dashboard
2. Go to the "Storage" tab
3. If you don't see a bucket named `media`:
   - Click "New Bucket"
   - Name: `media`
   - Make it public: Yes (if you want images to be publicly accessible)
   - Click "Create bucket"

## 2. Set Up the Correct Folder Structure

Your code is trying to upload images to `events/backgrounds/` within the media bucket. Create this folder structure:

1. Click on the `media` bucket
2. Click "Create Folder"
3. Name: `events`
4. Click "Create"
5. Navigate into the `events` folder
6. Click "Create Folder"
7. Name: `backgrounds`
8. Click "Create"

## 3. Configure Storage Permissions

Make sure your storage bucket has the right permissions:

1. Go to the "Storage" tab
2. Click on "Policies" for the `media` bucket
3. Add these policies:

### For Reading Images (GET)
- Policy name: `Public Access`
- Allowed operations: `SELECT`
- Policy definition: `true` (allows anyone to view images)

### For Uploading Images (INSERT)
- Policy name: `Authenticated Users Can Upload`
- Allowed operations: `INSERT`
- Policy definition: `auth.role() = 'authenticated'`

### For Updating/Replacing Images (UPDATE)
- Policy name: `Authenticated Users Can Update Own Images`
- Allowed operations: `UPDATE`
- Policy definition: `auth.uid() = created_by`

### For Deleting Images (DELETE)
- Policy name: `Authenticated Users Can Delete Own Images`
- Allowed operations: `DELETE`
- Policy definition: `auth.uid() = created_by`

## 4. Test the Storage Setup

After setting up the storage bucket and permissions, you can test it directly:

1. Go to the `media` bucket
2. Navigate to the `events/backgrounds` folder
3. Click "Upload File" and upload a test image
4. Verify you can view the image URL

## 5. Update Your Code (if needed)

If you're still having issues, you might need to update your code to match your actual bucket name. In `src/screens/CreateEventScreen.tsx`, find the `uploadBackgroundImage` function and make sure it's using the correct bucket name:

```typescript
// Upload to Supabase Storage
console.log(`Uploading to Supabase storage bucket '${bucketName}'...`);
const { data, error } = await supabase.storage
  .from('media') // Make sure this matches your actual bucket name
  .upload(filePath, decode(base64), {
    contentType: `image/${fileExt}`,
    upsert: true
  });
```

If your bucket has a different name, update it accordingly. 