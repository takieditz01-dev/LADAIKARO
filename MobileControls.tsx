import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  onMove: (x: number, y: number) => void;
  onAction: (action: 'light' | 'heavy' | 'special' | 'jump' | 'dodge' | 'block_start' | 'block_end') => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onMove, onAction }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef<number | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.4;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / maxR, dy / maxR);
  };

  const resetStick = () => {
    activeTouchId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-between px-4 pb-5 sm:px-6">
      {/* Left Virtual Joystick */}
      <div
        ref={padRef}
        className="pointer-events-auto relative h-28 w-28 rounded-full border-2 border-[#d4a84b]/50 bg-[#0d1411]/70 touch-none"
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          activeTouchId.current = e.pointerId;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activeTouchId.current !== e.pointerId) return;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activeTouchId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={resetStick}
      >
        <div
          className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5d88c] bg-[#d4a84b]/80"
          style={{
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>

      {/* Right Combat Buttons */}
      <div className="pointer-events-auto grid grid-cols-3 gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('dodge');
          }}
          className="h-12 w-14 rounded-lg border border-sky-400/50 bg-[#102430]/85 text-xs font-bold text-sky-200 active:scale-95"
        >
          DODGE
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('jump');
          }}
          className="h-12 w-14 rounded-lg border border-emerald-400/50 bg-[#10291e]/85 text-xs font-bold text-emerald-200 active:scale-95"
        >
          JUMP
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('special');
          }}
          className="h-12 w-14 rounded-lg border border-amber-400/70 bg-[#3a250b]/90 text-xs font-bold text-amber-200 active:scale-95"
        >
          SPECIAL
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('block_start');
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onAction('block_end');
          }}
          onPointerCancel={() => onAction('block_end')}
          className="h-14 w-14 rounded-lg border border-indigo-400/60 bg-[#161c33]/85 text-xs font-bold text-indigo-200 active:scale-95"
        >
          BLOCK
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('light');
          }}
          className="h-14 w-14 rounded-lg border border-emerald-300/70 bg-[#193b2a]/90 text-xs font-bold text-white active:scale-95"
        >
          LIGHT
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onAction('heavy');
          }}
          className="h-14 w-14 rounded-lg border border-rose-400/70 bg-[#3d151b]/90 text-xs font-bold text-rose-100 active:scale-95"
        >
          HEAVY
        </button>
      </div>
    </div>
  );
};
