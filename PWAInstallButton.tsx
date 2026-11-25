import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1.5 rounded-xl border border-[#d4a84b]/70 bg-[#1a2820]/95 font-extrabold uppercase tracking-wider text-amber-200 hover:bg-[#24382c] transition ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
        }`}
        title="Download & Install WILD ARENA App"
      >
        <Download className="h-3.5 w-3.5 text-[#d4a84b]" />
        <span>{isInstallable ? 'Install Game' : 'Download App'}</span>
      </button>

      {showGuide && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#d4a84b]/70 bg-[#0d1512] p-5 text-left shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#d4a84b]">
                <Smartphone className="h-4 w-4" />
                <span>Download WILD ARENA</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded p-1 text-stone-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-3 space-y-2 text-xs text-stone-200">
                <p>Install WILD ARENA on iPhone or iPad as a fullscreen landscape app:</p>
                <ol className="list-decimal space-y-1 pl-4 text-stone-300">
                  <li>Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Launch <strong>Wild Arena</strong> from your Home Screen.</li>
                </ol>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-xs text-stone-200">
                <p>Install WILD ARENA directly to your device for standalone landscape play:</p>
                <ol className="list-decimal space-y-1 pl-4 text-stone-300">
                  <li>Open the browser menu (<strong>⋮</strong> or address bar <strong>Install</strong> icon).</li>
                  <li>Select <strong>Install WILD ARENA</strong> or <strong>Add to Home Screen</strong>.</li>
                  <li>If viewing inside an embedded preview, open the Shared App URL in a new browser tab to trigger one-click install.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-xl bg-[#d4a84b] py-2 text-xs font-black uppercase tracking-wider text-[#0c120f]"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
