import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VerifyInput = z.object({ code: z.string().min(1).max(200) });

/** Returns whether the caller has already passed owner verification. */
export const getOwnerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("owner_verifications")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ownerVerified: Boolean(data) };
  });

/**
 * Compares the submitted code with the server-only owner secret and records the
 * verification. Only a boolean leaves the server — never the secret itself.
 */
export const verifyOwnerCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { timingSafeCompare } = await import("./owner.server");
    const expected = process.env["OWNER_SECRET_CODE"];
    if (!expected) return { ok: false as const };
    if (!timingSafeCompare(data.code, expected)) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("owner_verifications")
      .upsert({ user_id: context.userId, verified_at: new Date().toISOString() });
    if (error) return { ok: false as const };
    return { ok: true as const };
  });
