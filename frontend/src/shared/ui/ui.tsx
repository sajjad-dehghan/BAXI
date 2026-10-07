import React from "react";
import { History, LoaderCircle, Navigation } from "lucide-react";
import { Draft, serviceNames } from "../lib/client";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Busy() {
  return <LoaderCircle size={18} className="spin" aria-label="در حال انجام" />;
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        b
      </span>
      <span>
        بکسی<small>BAXI</small>
      </span>
    </div>
  );
}
export function Empty({
  title,
  text,
  icon: Icon = History,
}: {
  title: string;
  text: string;
  icon?: typeof History;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function RouteSketch({
  draft,
  compact = false,
}: {
  draft: Draft;
  compact?: boolean;
}) {
  return (
    <div
      className={"route-sketch " + (compact ? "compact" : "")}
      aria-label="نمای شماتیک مسیر؛ نقشهٔ آنلاین نیست"
    >
      <svg viewBox="0 0 600 400" aria-hidden="true">
        <defs>
          <pattern
            id="blocks"
            width="120"
            height="90"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-18)"
          >
            <rect x="10" y="10" width="94" height="62" rx="10" fill="#ebeaf0" />
          </pattern>
        </defs>
        <rect width="600" height="400" fill="#f5f4f8" />
        <rect width="600" height="400" fill="url(#blocks)" />
        <path
          d="M-40 280L660 105 M100 -50L310 480 M360 -50L570 480"
          stroke="white"
          strokeWidth="26"
        />
        <path
          d="M170 280 C260 250 260 140 430 125"
          stroke="#7040bd"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="2 13"
        />
        <circle cx="170" cy="280" r="20" fill="white" />
        <circle cx="170" cy="280" r="11" fill="#7040bd" />
        <circle cx="430" cy="125" r="20" fill="white" />
        <circle cx="430" cy="125" r="11" fill="#252031" />
      </svg>
      <span className="map-tag origin">
        <span className="dot purple" />
        مبدأ
      </span>
      <span className="map-tag destination">
        <span className="dot dark" />
        مقصد
      </span>
      <div className="map-caption">
        <Navigation size={14} />
        <span>نمای شماتیک مسیر · بدون نقشهٔ آنلاین</span>
      </div>
      {!compact && (
        <div className="map-note">
          <span className="eyebrow">از اینجا تا اونجا</span>
          <h3>
            یک مسیر،
            <br />
            یک شروع تازه.
          </h3>
          <p>{serviceNames[draft.service]} همراه مسیر شماست.</p>
        </div>
      )}
    </div>
  );
}
