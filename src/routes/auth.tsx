import { BrandMark } from "@/components/farid/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FARID AI Assistant" },
      {
        name: "description",
        content:
          "Sign in to FARID AI to chat with your AI assistant and keep your conversation history in sync across devices.",
      },
      { property: "og:title", content: "Sign in — FARID AI Assistant" },
      {
        property: "og:description",
        content: "Sign in to FARID AI to chat with your AI assistant on any device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, navigate, session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSentTo(email);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("invalid login credentials")) {
        toast.error("Email or password is incorrect. Create an account first or reset your password.");
      } else {
        toast.error(message || "Sign in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setBusy(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });

      if (result.error) {
        toast.error("Google sign-in could not start. Please try again.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Password reset link sent. Check your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell safe-top safe-bottom flex flex-col items-center justify-center gap-6 bg-background px-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-16 shadow-glow" />
        <h1 className="font-display text-3xl font-bold text-gradient-brand">FARID AI</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Sign in to start chatting and keep your history on every device.
        </p>
      </div>

      {sentTo ? (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center">
          <h2 className="font-display text-lg">Check your email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to {sentTo}. Open it to activate your account, then sign in.
          </p>
          <Button
            variant="ghost"
            className="tap-target mt-3"
            onClick={() => {
              setSentTo(null);
              setMode("signin");
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          <Button
            variant="outline"
            className="tap-target h-12 w-full gap-2"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            <GoogleGlyph /> Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-0 px-0 py-0 text-xs"
                    disabled={busy}
                    onClick={sendPasswordReset}
                  >
                    Forgot password?
                  </Button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button type="submit" className="tap-target h-12 w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            {resetSent ? (
              <p className="text-center text-xs text-muted-foreground">
                Reset link sent. Check your inbox and spam folder.
              </p>
            ) : null}
          </form>

          <Button
            type="button"
            variant="link"
            className="tap-target w-full text-sm text-muted-foreground"
            onClick={() => {
              setResetSent(false);
              setMode(mode === "signup" ? "signin" : "signup");
            }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </Button>
        </div>
      )}
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1a7 7 0 0 1-6.5-4.8H1.5v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.5 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.5a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.5 6.7l4 3.1A7 7 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
