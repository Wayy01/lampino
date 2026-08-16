"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

interface RopePoint {
  x: number;
  y: number;
  ox: number;
  oy: number;
}

const SEGMENTS = 10;
const GRAVITY = 0.9;
const DAMPING = 0.985;
const ITERATIONS = 8;
// How far past its length the cord will let itself be pulled. Resistance grows
// exponentially toward this, so the last pixels are unreachable — the drag is
// bounded by the cord, never by the layout.
const MAX_STRETCH = 72;
// Per-frame speed cap. Keeps a hard flick (or the snap back from a deep pull)
// fast but survivable instead of launching the bulb off-screen.
const MAX_SPEED = 24;
const BULB_SCALE = 1.5;
const BULB_W = 92 * BULB_SCALE;
const BULB_H = 132 * BULB_SCALE;
const BULB_TOP_OFFSET = 10 * BULB_SCALE; // rope attaches near the top of the bulb cap

const LABEL = { ro: "Trage becul sau apasă pentru a-l aprinde / stinge", ru: "Потяните лампу или нажмите, чтобы включить / выключить" };

// A cord-and-bulb hero decoration: a small verlet rope simulation (gravity +
// distance constraints, no physics engine needed for one strand) drives an
// SVG cord and a DOM bulb. Drag the bulb to swing it — release and it settles
// back like it's really hanging. Click (no drag) toggles the light.
export function HeroLightbulb() {
  const { lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const bulbRef = useRef<HTMLDivElement>(null);

  const pointsRef = useRef<RopePoint[]>([]);
  const anchorRef = useRef({ x: 0, y: 0 });
  const ropeLenRef = useRef(260);
  const segLenRef = useRef(26);
  const draggingRef = useRef(false);
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef({ startX: 0, startY: 0, startTime: 0, moved: false });

  const [ready, setReady] = useState(false);
  const [isOn, setIsOn] = useState(true);

  // (Re)build the rope whenever the container is sized/resized, with a small
  // sideways offset on the bulb so it swings into rest on first paint.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const setupRope = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const anchorX = width / 2;
      const anchorY = 8;
      const ropeLen = Math.min(Math.max(height * 0.55, 150), 440);
      const segLen = ropeLen / SEGMENTS;

      anchorRef.current = { x: anchorX, y: anchorY };
      ropeLenRef.current = ropeLen;
      segLenRef.current = segLen;

      const entrySwing = 64;
      const pts: RopePoint[] = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const x = anchorX + entrySwing * t;
        const y = anchorY + segLen * i;
        pts.push({ x, y, ox: x, oy: y });
      }
      pointsRef.current = pts;
      dragTargetRef.current = { x: anchorX, y: anchorY + ropeLen };
      setReady(true);
    };

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setupRope(width, height);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Continuous verlet integration + distance-constraint solve, driving the
  // SVG cord path and the bulb's transform imperatively (no re-render/frame).
  useEffect(() => {
    let raf = 0;

    const render = () => {
      const points = pointsRef.current;
      const n = points.length - 1;
      if (n < 1) return;

      if (pathRef.current) {
        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < n; i++) {
          const midX = (points[i].x + points[i + 1].x) / 2;
          const midY = (points[i].y + points[i + 1].y) / 2;
          d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
        }
        d += ` L ${points[n].x.toFixed(1)} ${points[n].y.toFixed(1)}`;
        pathRef.current.setAttribute("d", d);
      }

      if (bulbRef.current) {
        const last = points[n];
        const prev = points[n - 1];
        const angle = Math.max(
          -65,
          Math.min(65, Math.atan2(last.x - prev.x, last.y - prev.y) * (180 / Math.PI)),
        );
        bulbRef.current.style.transform = `translate3d(${(last.x - BULB_W / 2).toFixed(1)}px, ${(last.y - BULB_TOP_OFFSET).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`;
      }
    };

    const step = () => {
      const points = pointsRef.current;
      const n = points.length - 1;
      if (n < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      const anchor = anchorRef.current;
      const segLen = segLenRef.current;
      const ropeLen = ropeLenRef.current;
      const dragging = draggingRef.current;

      // The ceiling point breathes a few pixels on a slow, non-repeating drift.
      // Well below the cord's own swing frequency, so the bulb just follows it
      // instead of resonating — a couple of pixels of life, never more.
      const t = performance.now() / 1000;
      points[0].x = anchor.x + Math.sin(t * 0.9) * 1.6 + Math.sin(t * 0.47 + 1.7) * 1.0;
      points[0].y = anchor.y + Math.sin(t * 0.63 + 0.8) * 0.8;
      points[0].ox = points[0].x;
      points[0].oy = points[0].y;

      if (dragging) {
        const target = dragTargetRef.current;
        const dx = target.x - points[0].x;
        const dy = target.y - points[0].y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        let tx = target.x;
        let ty = target.y;
        if (dist > ropeLen) {
          const eased = ropeLen + MAX_STRETCH * (1 - Math.exp(-(dist - ropeLen) / MAX_STRETCH));
          const s = eased / dist;
          tx = points[0].x + dx * s;
          ty = points[0].y + dy * s;
        }
        const last = points[n];
        last.ox = last.x;
        last.oy = last.y;
        last.x = tx;
        last.y = ty;
      }

      for (let i = 1; i <= n; i++) {
        if (dragging && i === n) continue;
        const p = points[i];
        let vx = (p.x - p.ox) * DAMPING;
        let vy = (p.y - p.oy) * DAMPING;
        const speed = Math.hypot(vx, vy);
        if (speed > MAX_SPEED) {
          vx = (vx / speed) * MAX_SPEED;
          vy = (vy / speed) * MAX_SPEED;
        }
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx;
        p.y += vy + GRAVITY;
      }

      for (let iter = 0; iter < ITERATIONS; iter++) {
        for (let i = 0; i < n; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p1Fixed = i === 0;
          const p2Fixed = dragging && i + 1 === n;
          if (p1Fixed && p2Fixed) continue;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = (dist - segLen) / dist;
          if (p1Fixed) {
            p2.x -= dx * diff;
            p2.y -= dy * diff;
          } else if (p2Fixed) {
            p1.x += dx * diff;
            p1.y += dy * diff;
          } else {
            p1.x += dx * diff * 0.5;
            p1.y += dy * diff * 0.5;
            p2.x -= dx * diff * 0.5;
            p2.y -= dy * diff * 0.5;
          }
        }
      }

      render();
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || pointsRef.current.length === 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("cursor-grabbing");
    draggingRef.current = true;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, startTime: performance.now(), moved: false };

    // Keep the grab point under the cursor instead of teleporting the cord's
    // end to it — grabbing the glass shouldn't yank the bulb up by its cap.
    const points = pointsRef.current;
    const tip = points[points.length - 1];
    const rect = containerRef.current.getBoundingClientRect();
    grabOffsetRef.current = { x: tip.x - (e.clientX - rect.left), y: tip.y - (e.clientY - rect.top) };
    dragTargetRef.current = { x: tip.x, y: tip.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    if (Math.hypot(dx, dy) > 6) dragStateRef.current.moved = true;
    const rect = containerRef.current.getBoundingClientRect();
    const grab = grabOffsetRef.current;
    dragTargetRef.current = { x: e.clientX - rect.left + grab.x, y: e.clientY - rect.top + grab.y };
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.classList.remove("cursor-grabbing");
    const elapsed = performance.now() - dragStateRef.current.startTime;
    if (!dragStateRef.current.moved && elapsed < 400) {
      setIsOn((v) => !v);
    }
  };

  const toggleOnKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOn((v) => !v);
    }
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* ceiling mount */}
      <div className="absolute left-1/2 top-0 h-3 w-8 -translate-x-1/2 rounded-b-sm bg-foreground/15" />

      <svg
        className={cn(
          // overflow-visible: the cord has to keep drawing once it's pulled
          // past the bottom of its box.
          "absolute inset-0 h-full w-full overflow-visible transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        <path ref={pathRef} d="" fill="none" stroke="var(--foreground)" strokeOpacity={0.28} strokeWidth={2.5} strokeLinecap="round" />
      </svg>

      <div
        ref={bulbRef}
        role="button"
        tabIndex={0}
        aria-pressed={isOn}
        aria-label={LABEL[lang]}
        data-on={isOn}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={toggleOnKey}
        className={cn(
          "absolute left-0 top-0 z-20 cursor-grab touch-none select-none outline-none transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
        style={{ width: BULB_W, transformOrigin: "50% 8%" }}
      >
        {/* outer glow halo */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -z-10 rounded-full blur-2xl transition-opacity duration-500 ease-out",
            isOn ? "opacity-100" : "opacity-0",
          )}
          style={{
            left: -84 * BULB_SCALE,
            top: -50 * BULB_SCALE,
            width: 260 * BULB_SCALE,
            height: 260 * BULB_SCALE,
            background:
              "radial-gradient(circle, rgba(255,196,110,0.55) 0%, rgba(255,170,70,0.22) 45%, rgba(255,170,70,0) 72%)",
          }}
        />

        <svg width={BULB_W} height={BULB_H} viewBox="0 0 92 132" className="relative drop-shadow-sm">
          {/* cord loop / cap */}
          <rect x="41" y="0" width="10" height="14" rx="3" fill="var(--foreground)" fillOpacity="0.55" />

          {/* screw base */}
          <rect x="34" y="86" width="24" height="8" rx="1.5" fill="#8a8378" />
          <rect x="35" y="96" width="22" height="6" rx="1.5" fill="#8a8378" />
          <rect x="36" y="104" width="20" height="6" rx="1.5" fill="#8a8378" />
          <path d="M37 110 h18 l-4 12 a10 10 0 0 1 -10 0 z" fill="#6f6a5f" />

          {/* glass globe */}
          <path
            d="M46 12 c-19 0 -32 14 -32 32 c0 15 9 24 15 30 c4 4 6 8 6 12 h22 c0 -4 2 -8 6 -12 c6 -6 15 -15 15 -30 c0 -18 -13 -32 -32 -32 z"
            className={cn("transition-colors duration-500", isOn ? "fill-[#ffe7b8]" : "fill-[#eae6dc]")}
            stroke={isOn ? "#f3b95f" : "#cfc9ba"}
            strokeWidth="1.5"
          />

          {/* filament */}
          <path
            d="M36 40 l6 10 l-4 6 l8 8 M56 40 l-6 10 l4 6 l-8 8"
            fill="none"
            className={cn("transition-colors duration-500", isOn ? "stroke-[#c8681f]" : "stroke-[#a39d8f]")}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* glass highlight */}
          <path
            d="M28 26 c-4 5 -6 11 -6 18"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={isOn ? 0.7 : 0.4}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
