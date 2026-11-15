import { cn } from "cn";
import { useId } from "react";

import type { BeaconState } from "@/lib/server/beacon";

/*
 * The Flame altar: a carved stone brazier on a plinth, its basin holding the
 * Flame, a ring of old runes turning behind it and the Shroud's mist pooling
 * at its foot. The three lit bays in the pedestal are the brand icon's
 * sliders. Colours and motion per state live in styles.css (`.altar`), so
 * the flame grows, gutters or dies out smoothly when the server changes.
 */

/** Rune glyphs on the ring, each drawn in an 8×8 box around 0,0. */
const RUNES = [
  "M-2 -4V4M-2 -4L2 -1M-2 0L2 3",
  "M0 -4V4M-3 -2L0 0L3 -2",
  "M-2 -4V4M2 -4V4M-2 -1L2 1",
  "M0 -4V4M0 -4L3 -1L0 2",
  "M-3 -4L3 4M3 -4L-3 4",
  "M0 -4V4M-3 1L0 -2L3 1",
  "M-2 -4V4M-2 -4L2 -2L-2 0",
  "M0 -4L3 0L0 4L-3 0Z",
];

/** Sparks rising off the Flame: [x, delay s, drift px, duration s]. */
const EMBERS: [number, number, number, number][] = [
  [92, 0, -10, 3.2],
  [106, 0.9, 8, 2.8],
  [99, 1.7, -4, 3.6],
  [113, 2.4, 12, 3],
  [86, 3.1, -14, 3.4],
];

/** Shroud spores hanging in the mist: [x, y, r, delay s]. */
const SPORES: [number, number, number, number][] = [
  [38, 206, 1, 0],
  [160, 196, 0.8, 1.4],
  [130, 230, 1, 2.6],
  [68, 233, 0.7, 0.8],
  [172, 222, 0.9, 3.2],
];

const FLAME = {
  outer:
    "M100 14C103 30 112 40 121 50C130 60 138 74 137 92C136 112 121 127 100 128C79 127 64 112 63 92C62 76 70 64 78 56C78 66 81 73 87 77C85 62 90 44 100 14Z",
  tongueRight: "M120 62C127 50 128 40 125 28C133 40 137 54 131 70Z",
  tongueLeft: "M75 68C68 58 67 48 71 38C73 48 78 55 84 61Z",
  middle:
    "M100 40C104 56 118 66 120 88C121 108 112 122 100 124C88 122 79 110 80 94C81 82 87 76 91 68C92 76 95 80 98 82C96 68 97 54 100 40Z",
  core: "M100 70C104 82 112 90 112 104C112 116 106 122 100 122C94 122 88 116 88 106C88 96 95 88 100 70Z",
};

const BOWL =
  "M51 124C53 143 72 155 100 155C128 155 147 143 149 124A49 7.5 0 0 1 51 124Z";

const SIZES = {
  /** The navigation rail: just the flame in its bowl. */
  sm: { box: "46 10 108 150", className: "size-9" },
  /** A page's hero. */
  lg: { box: "0 0 200 240", className: "h-36 w-30" },
  /** Full-window screens (loading, first run). */
  xl: { box: "0 0 200 240", className: "h-60 w-50" },
};

type FlameBeaconProps = {
  state: BeaconState;
  size?: keyof typeof SIZES;
  className?: string;
};

export const FlameBeacon = ({
  state,
  size = "lg",
  className,
}: FlameBeaconProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `altar-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const full = size !== "sm";

  return (
    <svg
      aria-hidden="true"
      data-state={state}
      viewBox={SIZES[size].box}
      className={cn(
        "altar shrink-0 overflow-visible",
        SIZES[size].className,
        className,
      )}
    >
      <defs>
        <linearGradient id={id("stone")} x1="0" x2="1">
          <stop offset="0" stopColor="#241F30" />
          <stop offset="0.3" stopColor="#6A6478" />
          <stop offset="0.62" stopColor="#453F55" />
          <stop offset="1" stopColor="#1D1828" />
        </linearGradient>
        <linearGradient id={id("lit")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="altar-stop-lit" />
          <stop offset="1" className="altar-stop-glow" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("outer")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="altar-stop-o1" />
          <stop offset="1" className="altar-stop-o2" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id={id("middle")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="altar-stop-m1" />
          <stop offset="1" className="altar-stop-m2" />
        </linearGradient>
        <radialGradient
          id={id("halo")}
          cx="100"
          cy="92"
          r="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" className="altar-stop-glow" stopOpacity="0.5" />
          <stop offset="0.5" className="altar-stop-glow" stopOpacity="0.12" />
          <stop offset="1" className="altar-stop-glow" stopOpacity="0" />
        </radialGradient>
        <filter id={id("b2")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id={id("b6")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {full ? (
        <>
          <circle
            className="altar-halo"
            cx="100"
            cy="92"
            r="82"
            fill={url("halo")}
          />
          {/* The rune ring */}
          <g className="altar-ring" fill="none">
            <circle cx="100" cy="88" r="74" strokeWidth="0.8" />
            <circle
              cx="100"
              cy="88"
              r="64"
              strokeWidth="0.6"
              strokeDasharray="2 4"
              opacity="0.6"
            />
            <path
              className="altar-ring-notches"
              stroke="none"
              d="M100 10l4 4-4 4-4-4zM100 158l4 4-4 4-4-4zM22 88l4-4 4 4-4 4zM178 88l-4-4-4 4 4 4z"
            />
            <g strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              {RUNES.map((d, i) => (
                <path
                  key={d}
                  transform={`rotate(${22.5 + 45 * i} 100 88) translate(100 17)`}
                  d={d}
                />
              ))}
            </g>
          </g>
        </>
      ) : null}

      {/* The Flame */}
      <g className="altar-flame">
        <ellipse
          className="altar-bloom"
          cx="100"
          cy="96"
          rx="30"
          ry="34"
          filter={url("b6")}
        />
        <g className="altar-flame-motion">
          <path
            className="altar-flame-outer"
            d={FLAME.outer}
            fill={url("outer")}
            filter={url("b2")}
            opacity="0.7"
          />
          <path
            className="altar-flame-outer"
            d={FLAME.outer}
            fill={url("outer")}
          />
          <path
            className="altar-tongue altar-tongue-right"
            d={FLAME.tongueRight}
            fill={url("outer")}
          />
          <path
            className="altar-tongue altar-tongue-left"
            d={FLAME.tongueLeft}
            fill={url("outer")}
          />
          <path
            className="altar-flame-middle"
            d={FLAME.middle}
            fill={url("middle")}
          />
          <path className="altar-flame-core" d={FLAME.core} />
        </g>
      </g>
      {/* What's left when it's out */}
      <path
        className="altar-smoke"
        d="M100 120C94 108 106 96 100 84C94 72 104 62 100 50C97 44 101 38 100 32"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        filter={url("b2")}
      />

      {/* Claws holding the basin */}
      <g fill={url("stone")}>
        <path d="M60 140C47 137 41 126 44 113C46 121 51 126 58 128L62 131Z" />
        <path d="M140 140C153 137 159 126 156 113C154 121 149 126 142 128L138 131Z" />
      </g>
      <g className="altar-edge-light" fill="none" strokeWidth="0.9">
        <path d="M44 113C46 121 51 126 58 128" />
        <path d="M156 113C154 121 149 126 142 128" />
      </g>

      {/* The basin */}
      <ellipse cx="100" cy="124" rx="49" ry="7.5" fill="#120C1E" />
      <ellipse
        className="altar-basin-glow"
        cx="100"
        cy="124"
        rx="40"
        ry="5"
        filter={url("b2")}
      />
      <ellipse
        className="altar-coals"
        cx="100"
        cy="124"
        rx="22"
        ry="3"
        filter={url("b2")}
      />
      <path d={BOWL} fill={url("stone")} />
      <path className="altar-firelit" d={BOWL} fill={url("lit")} />
      <path
        d="M56 136C72 144 128 144 144 136"
        fill="none"
        stroke="#0E0A18"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <path
        d="M56 137.5C72 145.5 128 145.5 144 137.5"
        fill="none"
        stroke="#8A83A0"
        strokeOpacity="0.2"
      />
      <g fill="none" stroke="#0E0A18" strokeOpacity="0.45">
        {[
          [68, 141.2],
          [80, 143.5],
          [92, 144.6],
          [108, 144.6],
          [120, 143.5],
          [132, 141.2],
        ].map(([x, y]) => (
          <path key={x} d={`M${x - 2.5} ${y}l2.5 2.5 2.5-2.5`} />
        ))}
      </g>
      <circle className="altar-seal" cx="100" cy="148" r="2.2" />
      <path
        className="altar-rim"
        d="M51 124A49 7.5 0 0 0 149 124"
        fill="none"
        strokeWidth="1.6"
      />

      {/* Neck and collar */}
      <path d="M89 154L92 161H108L111 154Z" fill="#1D1828" />
      <rect x="83" y="160" width="34" height="4" rx="1" fill={url("stone")} />

      {full ? (
        <>
          {/* Pedestal, with the three bays */}
          <path d="M85 164H115L121 204H79Z" fill={url("stone")} />
          <path d="M85 164H90L84.5 204H79Z" fill="#8A83A0" fillOpacity="0.3" />
          <path
            d="M110 164H115L121 204H116Z"
            fill="#0E0A18"
            fillOpacity="0.5"
          />
          <path
            d="M84 168H116M83 179H117M82 189H118M81 199H119"
            stroke="#0E0A18"
            strokeOpacity="0.35"
          />
          <g fill="#120C1E">
            <rect x="88" y="171" width="24" height="6" rx="3" />
            <rect x="87.5" y="181" width="25" height="6" rx="3" />
            <rect x="87" y="191" width="26" height="6" rx="3" />
          </g>
          {[
            [90, 172.5, 15, 108],
            [89.5, 182.5, 15, 108],
            [89, 192.5, 16, 108.5],
          ].map(([x, y, w, knob], i) => (
            <g
              key={y}
              className="altar-bay"
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height="3"
                rx="1.5"
                filter={url("b2")}
              />
              <rect x={x} y={y} width={w} height="3" rx="1.5" />
              <circle
                className="altar-bay-knob"
                cx={knob}
                cy={y + 1.5}
                r="1.6"
              />
            </g>
          ))}

          {/* Plinth */}
          <path d="M72 204H128L132 211H68Z" fill={url("stone")} />
          <path d="M62 211H138L143 219H57Z" fill={url("stone")} />
          <path className="altar-step-light" d="M72 204H128M62 211H138" />

          {/* The Shroud at its foot */}
          <g className="altar-mist" filter={url("b6")}>
            <ellipse cx="62" cy="220" rx="34" ry="7" />
            <ellipse cx="140" cy="222" rx="38" ry="6" />
            <ellipse cx="100" cy="228" rx="54" ry="7" />
          </g>
          <g className="altar-spores">
            {SPORES.map(([x, y, r, delay]) => (
              <circle
                key={x}
                cx={x}
                cy={y}
                r={r}
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </g>
          <g className="altar-embers">
            {EMBERS.map(([x, delay, drift, duration]) => (
              <circle
                key={x}
                cx={x}
                cy="60"
                r="1.3"
                style={
                  {
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                    "--drift": `${drift}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </g>
        </>
      ) : null}
    </svg>
  );
};
