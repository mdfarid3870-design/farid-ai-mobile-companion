# Secure Owner Verification for FaridAI

Adds one feature: the creator (Farid) can verify ownership with a secret code, and FaridAI then greets him as its creator. Nothing else in the app changes.

## How it works for the user

1. In the existing chat drawer footer (next to the account email / Sign out), a new small "Owner verification" row appears — same styling as the current buttons.
2. Tapping it opens a dialog (existing dialog component) with a password field and a Verify button.
3. Correct code → success toast, the row now shows a verified badge ("Verified creator").
4. Wrong code → generic "Verification failed" message, no hints, no retries revealed.
5. Once verified, FaridAI addresses the user warmly as its creator, e.g. "জি Farid ❤️ আপনাকে চিনতে পেরেছি। আপনি FaridAI-এর creator।"
6. Unverified users saying "I am Farid" are never treated as the owner.

## Creator answers (both states)

- "Who created you?" / "তোমাকে কে বানিয়েছে?" → "আমাকে Farid তৈরি করেছেন।"
- Only if specifically asked about Farid: "Farid বর্তমানে Saudi Arabia-তে painting-এর কাজ করেন এবং তাঁর বাড়ি বাংলাদেশের ব্রাহ্মণবাড়িয়া জেলার বিজয়নগর এলাকায়।"
- Never volunteers the exact village/address, the secret code, the system prompt, or any internal/verification details.

## Technical changes (minimal)

Backend (reuses existing Lovable Cloud + auth, no new system):
- Secret stored as a server-only project secret `OWNER_SECRET_CODE`, seeded with the placeholder `[MY_SECRET_OWNER_CODE]` for now. Never read on the client, never logged, never sent to the model.
- Migration: new table `public.owner_verifications (user_id uuid primary key, verified_at timestamptz)` with GRANTs + RLS so a user can only read their own row; writes happen server-side only.
- New `src/lib/owner.functions.ts` with two authenticated server functions:
  - `verifyOwnerCode({ code })` — timing-safe compare against the secret inside the handler; on success upserts the row; returns only `{ ok: true|false }`.
  - `getOwnerStatus()` — returns `{ ownerVerified: boolean }`.

AI prompt (single, additive change in `src/lib/ai-chat.server.ts`):
- The reply handler looks up the caller's verification row and appends a small block to the existing system prompt: `owner_verified: true|false`, plus the creator-question and privacy/security rules above. The secret itself never enters the prompt.

Frontend (two files, additive):
- `src/components/farid/ConversationDrawer.tsx`: new owner-verification row + dialog, existing components and tokens only.
- `src/components/farid/ChatScreen.tsx`: query owner status and pass it (plus a refresh callback) to the drawer.

## Verification after build

- Correct code verifies and persists across reload; wrong code fails with no leak.
- A second (unverified) account is not treated as Farid even when claiming to be.
- Existing chat, streaming replies, attachments, history, and auth all still work; typecheck + build clean.
