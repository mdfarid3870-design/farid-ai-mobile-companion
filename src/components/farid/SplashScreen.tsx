import { BrandMark } from "./BrandMark";

/** Android-style launch screen, also used while the session is restored. */
export function SplashScreen() {
  return (
    <div className="app-shell safe-x flex flex-col items-center justify-center gap-5 bg-background px-6">
      <BrandMark className="size-20 shadow-glow" />
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient-brand">
          FARID AI
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Your intelligent AI assistant</p>
      </div>
      <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-brand" />
      </div>
    </div>
  );
}
