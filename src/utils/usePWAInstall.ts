import { useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * navigator.onLine sering keliru (false) di iframe/sandbox, VPN, atau adapter virtual,
 * padahal internet sebenarnya jalan. Jadi status "offline" hanya dipercaya kalau
 * pengecekan koneksi nyata (fetch ringan) juga gagal.
 */
async function probeConnectivity(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  // Mode file:// (Electron/lokal) tidak bisa diprobe lewat fetch -> percaya navigator
  if (!/^https?:$/.test(window.location.protocol)) return navigator.onLine;

  const tryFetch = async (url: string, init: RequestInit): Promise<boolean> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch(url, { ...init, cache: 'no-store', signal: ctrl.signal });
      return true; // respons apa pun (termasuk 404) = jaringan hidup
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  if (await tryFetch(`/icon.svg?_ping=${Date.now()}`, { method: 'GET' })) return true;
  return tryFetch('https://www.gstatic.com/generate_204', { method: 'GET', mode: 'no-cors' });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  // Default "online"; baru dianggap offline setelah dikonfirmasi oleh probe koneksi
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    // Detect standalone mode (already running as installed desktop/mobile app)
    const checkStandalone = () => {
      const standaloneQuery = window.matchMedia('(display-mode: standalone)').matches;
      const isWindowStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isFullscreenApp = window.matchMedia('(display-mode: fullscreen)').matches;
      const runningStandalone = standaloneQuery || isWindowStandalone || isFullscreenApp;
      setIsStandalone(runningStandalone);
      if (runningStandalone) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    let cancelled = false;
    const verify = async () => {
      const ok = await probeConnectivity();
      if (!cancelled) setIsOnline(ok);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      void verify(); // jangan langsung percaya event 'offline'
    };

    if (!navigator.onLine) void verify();
    // Selama terlihat offline, cek ulang berkala supaya banner hilang sendiri
    const recheck = window.setInterval(() => {
      if (!navigator.onLine || !isOnlineRef.current) void verify();
    }, 15000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.clearInterval(recheck);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('Error during PWA installation prompt:', err);
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isStandalone,
    isIOS,
    isOnline,
    install,
  };
}
