# FARID AI Mobile (31)

Update the existing FARID AI project and make it fully optimized for conversion into an Android APK.

Do NOT rebuild the app from scratch if the existing functionality already works. Preserve all existing FARID AI features and improve the project architecture where necessary.

ANDROID / PWA REQUIREMENTS

Make FARID AI a fully installable Progressive Web App (PWA).

Add:

- Web App Manifest
- Service Worker
- Offline fallback
- App icons
- Splash-screen compatible configuration
- Mobile viewport configuration
- Android standalone display mode
- Proper theme colors
- Responsive mobile layout

The app must feel like a real Android application when installed.

App identity

App name:

FARID AI

Short name:

FARID AI

Description:

FARID AI — Your intelligent AI assistant

The application must use FARID AI branding everywhere.

---

MOBILE-FIRST DESIGN

Optimize the entire application specifically for Android phones.

Support:

- 320px width
- 360px width
- 375px width
- 390px width
- 412px width
- Tablets
- Desktop

The interface must never overflow horizontally.

The chat input must remain usable when the Android keyboard opens.

Use safe-area support for modern Android devices.

---

ANDROID UI BEHAVIOR

When running as an installed PWA:

- Hide unnecessary browser-like UI
- Use standalone app behavior
- Support Android back navigation as much as possible
- Keep chat position stable
- Preserve the current conversation when the app is reopened
- Save theme preference
- Save login session
- Restore the previous conversation

---

PWA MANIFEST

Create a proper manifest file with:

- name
- short_name
- description
- start_url
- display: standalone
- orientation: portrait
- theme_color
- background_color
- icons

Use proper 192x192 and 512x512 app icons.

Make sure the manifest is actually linked from the application.

---

SERVICE WORKER

Implement a service worker carefully.

Cache only safe static resources.

Do NOT cache private AI responses or sensitive user data.

Provide an offline page/message such as:

"You're offline. Please reconnect to use FARID AI."

When internet connection returns, the application should become usable again.

---

APK CONVERSION READY

Structure the project so it can later be wrapped using Capacitor.

Use a standard web build output.

Do not depend on browser-only APIs that would prevent Android WebView/Capacitor compatibility.

Avoid unnecessary dependencies.

Keep the code compatible with modern Android WebView.

---

CAPACITOR COMPATIBILITY

Prepare the project for:

- Capacitor Android
- Android Studio
- Android APK generation

The project should be able to use a workflow similar to:

npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npm run build
npx cap sync
npx cap open android

Do not execute these commands unless the environment supports them.

Make sure the generated web build can be loaded correctly by Capacitor.

---

NATIVE-READY FEATURES

Structure the application so native Android features can later be added, including:

- Push notifications
- Camera
- File picker
- Image upload
- Share
- Clipboard
- Haptic feedback
- Android back button
- Local storage
- Secure storage

Do not add unnecessary native plugins now.

---

FILE UPLOAD

Prepare the chat interface for future:

- Images
- PDF
- TXT
- DOCX

uploads.

The UI should have an attachment button, but do not fake AI file analysis if the backend does not support it.

If file upload is not yet implemented, clearly structure the code so it can be added later.

---

GEMINI API SECURITY

The Android APK must NEVER contain the Gemini API key.

The architecture must remain:

Android App
↓
FARID AI Backend
↓
Gemini API

The Gemini key must remain on the server.

Use:

GEMINI_API_KEY

and:

GEMINI_MODEL

as server-side environment variables.

Never place them inside:

- frontend JavaScript
- React components
- HTML
- localStorage
- app configuration
- public environment variables

---

OFFLINE / NETWORK HANDLING

Detect:

- Online
- Offline
- API unavailable
- Server error
- Gemini quota exceeded

Show friendly messages.

Example:

"Internet connection is unavailable."

"FARID AI server is temporarily unavailable."

"AI usage limit has been reached. Please try again later."

Never expose raw server stack traces to users.

---

ANDROID KEYBOARD

This is extremely important.

When the Android keyboard opens:

- Chat input must remain visible
- Send button must remain accessible
- Message list must remain scrollable
- Do not allow the keyboard to cover the input
- Prevent unwanted page zooming
- Prevent layout jumping

Test with Android Chrome/WebView behavior in mind.

---

TOUCH EXPERIENCE

All interactive elements must be comfortable for touch.

Buttons should have sufficiently large touch targets.

Avoid tiny icons.

Add touch feedback where appropriate.

---

SPLASH SCREEN

Prepare the app for an Android-style splash screen using FARID AI branding.

Show:

FARID AI

with the subtitle:

Your intelligent AI assistant

Keep the splash screen simple and professional.

---

APP ICON

Create/use a clean FARID AI app icon.

It should work on:

- Android launcher
- PWA installation
- Capacitor APK

Provide required icon sizes and manifest references.

---

DATA PERSISTENCE

Preserve:

- Authentication session
- Theme
- Current conversation
- Chat history
- User preferences

Use the backend database for permanent chat history.

Do not rely only on localStorage for important user data.

---

SECURITY

For the future APK:

- No API secrets inside the APK
- No database admin keys inside the APK
- No service-role keys inside frontend code
- Validate backend requests
- Authenticate API requests
- Protect user data
- Use HTTPS
- Apply database access rules

---

FINAL TEST

Before considering the project complete, verify:

1. FARID AI loads correctly on Android.
2. PWA installation works.
3. App launches in standalone mode.
4. Login works.
5. New Chat works.
6. Gemini AI responses work.
7. Chat history works.
8. Rename works.
9. Delete works.
10. Pin works.
11. Search works.
12. Copy works.
13. Regenerate works.
14. Edit message works.
15. Dark mode works.
16. Light mode works.
17. Android keyboard does not cover the input.
18. No horizontal scrolling occurs.
19. Offline state works.
20. No Gemini API key is exposed to the client.
21. The project can be built for Capacitor Android.

Do not leave fake buttons or placeholder functionality.

The final application must be a polished:

FARID AI — Android-ready AI Chat App

designed to be converted into an APK using Capacitor.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://farid-ai-mobile-companion.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/700eace0-4189-4d50-b28b-b493730c3ff3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
