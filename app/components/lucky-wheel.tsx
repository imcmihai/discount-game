"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type Segment = {
  kind: "sorry" | "5" | "10" | "20" | "50" | "shirt";
  label: string;
  color: string;
  text: string;
};

// Every color is a shade drawn from the brand's own cream-to-brown range —
// dull, light tans for the weak outcomes, a warm gold for the common 10%
// win, and deepening terracotta/brown for the rarer prizes, bottoming out at
// the brand's exact dark brown for the top prize.
//
// 10% discount segments are spread evenly between every other slot, so every
// "weaker" outcome (Sorry / 5%) and every rare big prize sits directly next
// to a 10% win — landing there always feels like a narrow, lucky escape.
const SEGMENTS: Segment[] = [
  { kind: "20", label: "20% OFF", color: "#C97A34", text: "#FDF5E5" },
  { kind: "10", label: "10% OFF", color: "#E4A63D", text: "#37160C" },
  { kind: "shirt", label: "Free T-Shirt", color: "#37160C", text: "#FDF5E5" },
  { kind: "10", label: "10% OFF", color: "#E4A63D", text: "#37160C" },
  { kind: "50", label: "50% OFF", color: "#8A4A26", text: "#FDF5E5" },
  { kind: "10", label: "10% OFF", color: "#E4A63D", text: "#37160C" },
  { kind: "5", label: "5% OFF", color: "#EEDDBB", text: "#37160C" },
  { kind: "10", label: "10% OFF", color: "#E4A63D", text: "#37160C" },
  { kind: "sorry", label: "Maybe Next Time", color: "#D9CBB2", text: "#37160C" },
  { kind: "10", label: "10% OFF", color: "#E4A63D", text: "#37160C" },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const TEN_PERCENT_INDICES = SEGMENTS.reduce<number[]>((acc, seg, i) => {
  if (seg.kind === "10") acc.push(i);
  return acc;
}, []);

const SPIN_DURATION_MS = 4600;
const EXTRA_SPINS = 6;
const LABEL_RADIUS = 92;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

type LuckyWheelProps = {
  onPlayAgain?: () => void;
};

export default function LuckyWheel({ onPlayAgain }: LuckyWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Segment | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conicBackground = useMemo(() => {
    const stops = SEGMENTS.map(
      (seg, i) => `${seg.color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`,
    ).join(", ");
    return `repeating-conic-gradient(from 0deg, rgba(55,22,12,0.22) 0deg 0.6deg, transparent 0.6deg ${SEGMENT_ANGLE}deg), conic-gradient(${stops})`;
  }, []);

  const spin = useCallback(() => {
    if (spinning || result) return;
    setSpinning(true);

    const targetIndex =
      TEN_PERCENT_INDICES[Math.floor(Math.random() * TEN_PERCENT_INDICES.length)];
    const center = targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const jitter = (Math.random() - 0.5) * (SEGMENT_ANGLE * 0.5);
    const targetMod = (360 - center - jitter + 360) % 360;

    setRotation((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      let delta = targetMod - prevMod;
      if (delta <= 0) delta += 360;
      return prev + delta + 360 * EXTRA_SPINS;
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSpinning(false);
      setResult(SEGMENTS[targetIndex]);
    }, SPIN_DURATION_MS);
  }, [spinning, result]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-between bg-[#FDF5E5] px-6 py-12 text-center">
      <div className="space-y-1">
        <p className="text-3xl font-semibold text-[#37160C]">Challange your luck</p>
        <p className="text-md text-[#37160C]/70">
          {result ? "Here's what you won!" : "For our debut collection we wanted to make it fun and also give back to you a little something. So here it is, see if you get lucky!"}
        </p>
      </div>

      <div className="relative mx-auto aspect-square w-64 max-w-full">
        <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-[#37160C] drop-shadow-md" />
        </div>

        <div
          className="absolute inset-0 rounded-full shadow-[0_10px_30px_rgba(55,22,12,0.3)] ring-[6px] ring-[#37160C]"
          style={{
            background: conicBackground,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.67, 0.14, 1)`
              : "none",
          }}
        >
          {SEGMENTS.map((seg, i) => {
            const mid = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
            // Labels on the lower half of the wheel would otherwise render
            // upside-down, since they inherit the segment's own rotation.
            const upsideDown = mid > 90 && mid < 270;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{ width: 0, height: 0, transform: `rotate(${mid}deg)` }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    transform: `translate(0, ${-LABEL_RADIUS}px) rotate(${upsideDown ? 180 : 0}deg)`,
                  }}
                >
                  <span
                    className="block text-[10px] font-bold leading-tight"
                    style={{
                      width: 64,
                      transform: "translateX(-50%)",
                      color: seg.text,
                    }}
                  >
                    {seg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#37160C] ring-4 ring-[#FDF5E5]" />
      </div>

      {result ? (
        <div className="w-full max-w-[260px] space-y-4">
          <div className="space-y-1">
            <p className="text-4xl">
              {result.kind === "sorry" ? "😔" : result.kind === "shirt" ? "👕" : "🏷️"}
            </p>
            <p className="text-2xl font-black text-[#37160C]">{result.label}</p>
          </div>
          {result.kind !== "sorry" && (
            <div className="rounded-2xl border-2 border-dashed border-[#37160C]/30 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#37160C]/50">
                Your one time use code
              </p>
              <p className="text-lg font-bold tracking-[0.2em] text-[#37160C]">
                VHQ4Y9JAB2DY
              </p>
              
            </div>
          )}
          <a href="https://citricvalley.com/discount/VHQ4Y9JAB2DY" className="text-lg font-bold underline">Use your discount</a>
          {/* <button
            type="button"
            onClick={onPlayAgain}
            className="w-full rounded-full bg-[#37160C] px-10 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95"
          >
            Play again
          </button> */}
        </div>
      ) : (
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="w-full max-w-[220px] rounded-full bg-[#37160C] px-10 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60"
        >
          {spinning ? "Spinning…" : "Spin the wheel"}
        </button>
      )}
    </div>
  );
}
