import React, { useEffect, useState } from 'react';
import { Maximize2, RotateCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';

export async function enterLandscapeFullscreen(): Promise<void> {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'landscape-primary') => Promise<void>;
    };
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // Some desktop or iOS Safari browsers restrict programmatic orientation lock
  }
}

export const LandscapeAndOfflineOverlay: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const isNarrowOrTouch = window.innerWidth < 900 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsPortraitMobile(portrait && isNarrowOrTouch);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/70 bg-[#2b1d0a]/95 px-3 py-1.5 text-xs font-bold text-amber-200">
          <WifiOff className="h-3.5 w-3.5 text-amber-300" />
          <span>Offline Mode — Solo Practice Available</span>
        </div>
      )}

      {isPortraitMobile && !dismissed && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090d0b]/95 p-6 text-center">
          <RotateCw className="h-12 w-12 text-[#d4a84b]" />
          <h2 className="font-display mt-4 text-2xl font-black tracking-wider text-white">
            LANDSCAPE MODE RECOMMENDED
          </h2>
          <p className="mt-2 max-w-xs text-xs text-stone-300">
            WILD ARENA is built for widescreen landscape combat. Rotate your device sideways or tap below to enter landscape fullscreen.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={() => void enterLandscapeFullscreen()}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#d4a84b] py-3 text-xs font-black uppercase tracking-wider text-[#0c120f]"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Lock Landscape & Fullscreen</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-xl border border-white/15 bg-[#131d18] py-2.5 text-xs font-bold text-stone-300"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      )}
    </>
  );
};
