import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstallable, setIsInstallable] =
    useState(false);


  useEffect(() => {

    const handler = (event: Event) => {
      event.preventDefault();

      setInstallPrompt(
        event as BeforeInstallPromptEvent
      );

      setIsInstallable(true);
    };


    window.addEventListener(
      "beforeinstallprompt",
      handler
    );


    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler
      );
    };

  }, []);


  const installPWA = async () => {

    if (!installPrompt) return false;

    await installPrompt.prompt();

    const result = await installPrompt.userChoice;

    setInstallPrompt(null);
    setIsInstallable(false);

    return result.outcome === "accepted";
  };


  return {
    isInstallable,
    installPWA
  };
}