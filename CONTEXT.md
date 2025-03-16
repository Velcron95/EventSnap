EventSnap is a React Native (Expo) app with Supabase and TypeScript.
It allows event attendees to take pictures and record videos within the app, which are automatically uploaded to a shared event gallery that updates live.

App Flow:
1. Authentication:
   - First-time users register with email, password, and display name
   - Returning users log in with email and password
2. Permissions:
   - App requests camera and media library access if not already granted
3. Event Connection:
   - Users can:
     - Create a new event
     - Join an existing event using event name and password
     - Search for available events to connect to

Authentication Details:
- "Keep me logged in" option available on the login screen
- Users must be authenticated to access any app features

Key Features:
- Live photo and video uploads to a shared event gallery
- Real-time updates for all attendees
- User authentication via Supabase Auth (email & password signup)
- Event creation and joining system:
  - Event starters can create an event by entering a name and password
  - Users can join an event by entering the event name and password
  - Once joined, users always have access to the event
- Users can take pictures or record videos, confirm them, and they will be automatically uploaded for everyone to see
- All uploaded images and videos are viewable in a separate tab
- Users can download images and videos from the app to their phone
- Uploaded images and videos cannot be deleted by users
