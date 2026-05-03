"use client";

import type { ReactNode } from "react";

export interface ArtifactTab {
  id: string;
  label: string;
}

export function ArtifactPanel(props: {
  title: string;
  filename?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  tabs?: ArtifactTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  loading?: boolean;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-ink-50 overflow-hidden shadow-[0_1px_0_rgba(20,19,16,0.03)]">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-ink-200/70 bg-ink-100/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink-500 shrink-0">{props.icon ?? <DocIcon />}</span>
          <span className="text-[13px] font-medium text-ink-800 truncate">{props.title}</span>
          {props.filename && (
            <span className="text-[12px] font-mono text-ink-500 truncate">{props.filename}</span>
          )}
          {props.badge && <span className="shrink-0">{props.badge}</span>}
        </div>
        {props.actions && (
          <div className="flex items-center gap-1.5 shrink-0">{props.actions}</div>
        )}
      </div>

      {props.tabs && props.tabs.length > 0 && (
        <div className="flex gap-0.5 px-2 pt-1.5 border-b border-ink-200/70 bg-ink-100/30 overflow-x-auto">
          {props.tabs.map((t) => {
            const active = props.activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => props.onTabChange?.(t.id)}
                className={
                  "shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-t-md transition-colors " +
                  (active
                    ? "bg-ink-50 text-ink-900 border border-ink-200/80 border-b-ink-50 -mb-px"
                    : "text-ink-500 hover:text-ink-800")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className={props.bodyClassName ?? "p-5"}>
        {props.loading ? <ArtifactSkeleton /> : props.children}
      </div>
    </div>
  );
}

export function ArtifactIconBtn(props: {
  onClick?: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      aria-label={props.title}
      disabled={props.disabled}
      className="h-7 w-7 grid place-items-center rounded-md text-ink-500 hover:text-ink-800 hover:bg-ink-200/60 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {props.children}
    </button>
  );
}

export function ArtifactPillBtn(props: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const v = props.variant ?? "primary";
  const cls =
    v === "primary"
      ? "bg-accent-600 text-ink-50 hover:bg-accent-500"
      : "bg-ink-200/60 text-ink-800 hover:bg-ink-200";
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {props.children}
    </button>
  );
}

export function ArtifactEmptyState(props: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300/80 bg-ink-50/40 p-10 text-center">
      <div className="mx-auto mb-3 h-9 w-9 rounded-xl bg-ink-100 grid place-items-center text-ink-400">
        <DocIcon size={16} />
      </div>
      <div className="font-serif text-ink-800 text-base">{props.title}</div>
      <div className="text-sm text-ink-500 mt-1">{props.description}</div>
    </div>
  );
}

function ArtifactSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 bg-ink-200 rounded w-1/3" />
      <div className="h-3 bg-ink-200 rounded w-3/4" />
      <div className="h-3 bg-ink-200 rounded w-2/3" />
      <div className="h-24 bg-ink-200/60 rounded" />
    </div>
  );
}

function DocIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M3 2.5h6.5L13 6v7.5H3z" />
      <path d="M9.5 2.5V6H13" />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <rect x="5" y="5" width="8" height="9" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  );
}

export function FlaskIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M6 2v4L3 13a1.5 1.5 0 0 0 1.3 2.2h7.4A1.5 1.5 0 0 0 13 13l-3-7V2" />
      <path d="M5 2h6" />
    </svg>
  );
}
