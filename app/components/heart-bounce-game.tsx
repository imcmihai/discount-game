"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LuckyWheel from "./lucky-wheel";

const BALL_SIZE = 46;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 40;
const PADDLE_BOTTOM_OFFSET = 90;
const BASE_BALL_SPEED = 460; // px/s, constant per-bounce — no gravity
const SPEED_PER_POINT = 14; // px/s added to speed for every point scored
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // radians off vertical
const BEST_SCORE_KEY = "heart-bounce-best";
const WIN_SCORE = 20;

const speedForScore = (points: number) =>
  BASE_BALL_SPEED + points * SPEED_PER_POINT;

type Rect = { left: number; top: number; width: number; height: number };
type GameStatus = "idle" | "playing" | "over" | "wheel";

export default function HeartBounceGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const paddleRef = useRef<HTMLDivElement>(null);

  const rectRef = useRef<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const ball = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const paddleX = useRef(0);
  const rafId = useRef<number | null>(null);
  const lastTime = useRef<number | null>(null);
  const running = useRef(false);
  const scoreRef = useRef(0);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<GameStatus>("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) setBest(Number(stored) || 0);
  }, []);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    rectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const placePaddle = useCallback((x: number) => {
    const { width } = rectRef.current;
    const half = PADDLE_WIDTH / 2;
    const clamped = Math.max(half, Math.min(width - half, x));
    paddleX.current = clamped;
    if (paddleRef.current) {
      paddleRef.current.style.transform = `translate3d(${clamped - half}px, 0, 0)`;
    }
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const { left, width } = rectRef.current;
      if (width === 0) return;
      placePaddle(e.clientX - left);
    };
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [placePaddle]);

  const stopGame = useCallback((nextStatus: "over" | "wheel") => {
    running.current = false;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    setStatus(nextStatus);
    setBest((prevBest) => {
      const next = Math.max(prevBest, scoreRef.current);
      window.localStorage.setItem(BEST_SCORE_KEY, String(next));
      return next;
    });
  }, []);

  const loop = useCallback(
    (timestamp: number) => {
      if (!running.current) return;
      if (lastTime.current === null) lastTime.current = timestamp;
      const dt = Math.min((timestamp - lastTime.current) / 1000, 0.032);
      lastTime.current = timestamp;

      const { width, height } = rectRef.current;
      const b = ball.current;
      const prevBottom = b.y + BALL_SIZE;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x <= 0) {
        b.x = 0;
        b.vx = Math.abs(b.vx);
      } else if (b.x + BALL_SIZE >= width) {
        b.x = width - BALL_SIZE;
        b.vx = -Math.abs(b.vx);
      }

      if (b.y <= 0) {
        b.y = 0;
        b.vy = Math.abs(b.vy);
      }

      const paddleTop = height - PADDLE_BOTTOM_OFFSET - PADDLE_HEIGHT / 2;
      const ballBottom = b.y + BALL_SIZE;
      const ballCenterX = b.x + BALL_SIZE / 2;
      const paddleLeft = paddleX.current - PADDLE_WIDTH / 2 - 6;
      const paddleRight = paddleX.current + PADDLE_WIDTH / 2 + 6;

      const crossedPaddle =
        b.vy > 0 && prevBottom <= paddleTop + 4 && ballBottom >= paddleTop;

      if (
        crossedPaddle &&
        ballCenterX >= paddleLeft &&
        ballCenterX <= paddleRight
      ) {
        b.y = paddleTop - BALL_SIZE;
        const hitOffset = Math.max(
          -1,
          Math.min(1, (ballCenterX - paddleX.current) / (PADDLE_WIDTH / 2)),
        );
        const angle = hitOffset * MAX_BOUNCE_ANGLE;
        const speed = speedForScore(scoreRef.current + 1);
        b.vx = speed * Math.sin(angle);
        b.vy = -speed * Math.cos(angle);
        scoreRef.current += 1;
        setScore(scoreRef.current);

        if (scoreRef.current >= WIN_SCORE) {
          stopGame("wheel");
          return;
        }
      }

      if (b.y > height) {
        stopGame("over");
        return;
      }

      if (ballRef.current) {
        const tilt = Math.max(-25, Math.min(25, b.vx * 0.03));
        ballRef.current.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${tilt}deg)`;
      }

      rafId.current = requestAnimationFrame(loop);
    },
    [stopGame],
  );

  const startGame = useCallback(() => {
    measure();
    const { width, height } = rectRef.current;

    placePaddle(width / 2);

    const startAngle = (Math.random() * 2 - 1) * MAX_BOUNCE_ANGLE * 0.6;
    const startSpeed = speedForScore(0);
    ball.current = {
      x: width / 2 - BALL_SIZE / 2,
      y: height * 0.22,
      vx: startSpeed * Math.sin(startAngle),
      vy: startSpeed * Math.cos(startAngle),
    };

    scoreRef.current = 0;
    setScore(0);
    setStatus("playing");
    running.current = true;
    lastTime.current = null;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(loop);
  }, [measure, placePaddle, loop]);

  useEffect(() => {
    return () => {
      running.current = false;
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    running.current = false;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    setStatus("idle");
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full max-w-sm touch-none select-none flex-col overflow-hidden bg-[#FDF5E5] sm:h-[min(860px,100%)] sm:rounded-[2.5rem] sm:shadow-2xl"
    >
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center text-2xl leading-none text-[#37160C]/70 transition-transform active:scale-90"
        >
          &times;
        </button>

        <div className="flex items-center gap-2">
          {/* <span className="text-sm font-semibold tabular-nums text-[#37160C]/50">
            {String(score).padStart(3, "0")}
          </span>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#37160C]/15 to-[#37160C]/5 text-base ring-2 ring-white">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">
              👑
            </span>
            🧡
          </div> */}
          <span className="max-w-[110px] whitespace-nowrap text-[20px] font-semibold text-[#37160C]/60">
            {Math.max(WIN_SCORE - score, 0)} to 🎁
          </span>
        </div>
      </div>

      {/* Big background score */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <span className="text-[9rem] font-black leading-none text-[#37160C]/10">
          {score}
        </span>
      </div>

      {/* Ball */}
      <div
        ref={ballRef}
        className={`absolute left-0 top-0 z-10 will-change-transform ${
          status === "playing" ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: BALL_SIZE, height: BALL_SIZE }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/LOGOICON.png"
          alt=""
          draggable={false}
          className="h-full w-full object-contain drop-shadow-md"
        />
      </div>

      {/* Paddle */}
      <div
        ref={paddleRef}
        className={`absolute left-0 z-10 rounded-full bg-[#37160C] will-change-transform ${
          status === "playing" ? "opacity-100" : "opacity-0"
        }`}
        style={{
          width: PADDLE_WIDTH,
          height: PADDLE_HEIGHT,
          bottom: PADDLE_BOTTOM_OFFSET - PADDLE_HEIGHT / 2,
        }}
      />

      {/* Start / Game over overlay */}
      {(status === "idle" || status === "over") && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between bg-[#FDF5E5]/95 px-8 py-16 text-center">
          <div />
          <div className="space-y-2">
            {status === "over" ? (
              <>
                <p className="text-sm font-medium text-[#37160C]/60">
                  Game over
                </p>
                <p className="text-5xl font-black text-[#37160C]">{score}</p>
                {best > 0 && (
                  <p className="text-xs font-medium text-[#37160C]/50">
                    Best {best}
                  </p>
                )}
              </>
            ) : (
              <img src="/textlogo.png"></img>
            )}
          </div>
          <button
            type="button"
            onClick={startGame}
            className="w-full max-w-[220px] rounded-full bg-[#37160C] px-10 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95"
          >
            {status === "over" ? "Play again" : "Start"}
          </button>
        </div>
      )}

      {/* Lucky wheel hand-off screen */}
      {status === "wheel" && <LuckyWheel onPlayAgain={startGame} />}
    </div>
  );
}
