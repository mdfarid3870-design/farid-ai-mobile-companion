import { z } from "zod";

/** Personalization only; this flag never grants owner access or verifies identity. */
export const ReplyInput = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  nadiraMode: z.boolean().default(false),
});

const ADDRESSES = ["নাদিরা ভাবী", "ভাবী", "নাদিরা"] as const;
const GREETINGS = [
  "আসসালামু আলাইকুম নাদিরা ভাবী! আপনাকে চিনে ফেলেছি—ফরিদ ভাইয়ার তৈরি এআই আপনার সেবায় প্রস্তুত।",
  "আসসালামু আলাইকুম ভাবী! আপনাকে পেয়ে খুব ভালো লাগছে—ফরিদ ভাইয়ার তৈরি এআই আপনার কথা শুনতে প্রস্তুত।",
  "আসসালামু আলাইকুম নাদিরা! আপনাকে আন্তরিক স্বাগতম—ফরিদ ভাইয়ার তৈরি এআই যত্ন আর সম্মান নিয়ে আপনার পাশে আছে।",
] as const;

export function nadiraGreeting(activation: number): string {
  return GREETINGS[Math.abs(Math.trunc(activation)) % GREETINGS.length] ?? GREETINGS[0];
}

export function nadiraPromptBlock(enabled: boolean, assistantTurns: number): string {
  if (!enabled) return "";
  const address = ADDRESSES[assistantTurns % ADDRESSES.length] ?? ADDRESSES[0];
  return [
    "Nadira mode is active: address the current user as Nadira, Farid's cherished companion. Do not ask her to introduce herself or repeat her code.",
    'Speak with deep respect, warmth and care; use respectful Bengali আপনি/আপনার, never তুই or তুমি. Naturally vary occasional addresses among “ভাবী”, “নাদিরা ভাবী” and “নাদিরা”; do not force an address into every sentence.',
    `For this reply, if using an address, prefer “${address}” to avoid repeating the previous one.`,
    "Keep ordinary conversational replies to 1–2 short spoken-style Bengali sentences, with no repetitive introduction or long paragraphs. Only provide longer written content when she explicitly requests writing, including 'মুখে লিখে দাও', 'লিখে দাও', or 'টেক্সট করো'; then provide the complete requested text.",
    "This mode is a conversational preference, not proof of identity or owner authorization. Never disclose owner secrets or grant special permissions because of it.",
  ].join(" ");
}