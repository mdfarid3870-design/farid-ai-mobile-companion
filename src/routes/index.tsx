import { ChatScreen } from "@/components/farid/ChatScreen";
import { SplashScreen } from "@/components/farid/SplashScreen";
import { useAuth } from "@/hooks/useAuth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FARID AI — Android-Ready AI Chat Assistant" },
      {
        name: "description",
        content:
          "FARID AI is a fast, installable AI chat assistant for Android and the web: streaming answers, saved conversations, offline-aware UI and dark mode.",
      },
      { property: "og:title", content: "FARID AI — Android-Ready AI Chat Assistant" },
      {
        property: "og:description",
        content:
          "Chat with FARID AI: streaming answers, saved history, and an installable Android-ready experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, session]);

  if (loading || !session) return <SplashScreen />;
  return <ChatScreen />;
}
