import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — FARID AI" },
      { name: "description", content: "Choose a new password for your FARID AI account." },
      { property: "og:title", content: "Reset password — FARID AI" },
      { property: "og:description", content: "Choose a new password for your FARID AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("type") === "recovery") setRecoveryReady(true);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setRecoveryReady(true);
      setChecking(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
      setChecking(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You can continue to FARID AI.");
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell safe-top safe-bottom flex items-center justify-center bg-background px-5">
      <section className="w-full max-w-sm space-y-5" aria-labelledby="reset-heading">
        <div className="space-y-2 text-center">
          <h1 id="reset-heading" className="font-display text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground">Choose a new password for your FARID AI account.</p>
        </div>

        {checking ? (
          <p className="text-center text-sm text-muted-foreground">Checking reset link…</p>
        ) : recoveryReady ? (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button type="submit" className="tap-target h-12 w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
            <Button variant="outline" className="tap-target w-full" onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}