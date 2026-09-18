"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface TourStep {
  /** CSS selector for the element to spotlight. Omit for a centered,
   *  unanchored card (e.g. the welcome and closing steps). */
  target?: string;
  title: string;
  body: string;
  /** Marks a step whose target only exists once the host opens something
   *  (e.g. the organization detail panel). The host reacts via onStepChange;
   *  the tour itself just retries measuring until the target appears. */
  openPanel?: boolean;
}

const CARD_WIDTH = 340;
const HOLE_PAD = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 12;

interface Placement {
  cardTop: number;
  cardLeft: number;
  arrow: "up" | "down" | null;
  arrowLeft: number;
}

function centeredPlacement(): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    cardTop: Math.max(VIEWPORT_MARGIN, vh / 2 - 140),
    cardLeft: Math.max(VIEWPORT_MARGIN, vw / 2 - CARD_WIDTH / 2),
    arrow: null,
    arrowLeft: CARD_WIDTH / 2,
  };
}

function computePlacement(rect: DOMRect, cardHeight: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Horizontal: center the card on the target, then clamp into the viewport.
  const targetCenterX = rect.left + rect.width / 2;
  let cardLeft = targetCenterX - CARD_WIDTH / 2;
  cardLeft = Math.min(Math.max(cardLeft, VIEWPORT_MARGIN), vw - CARD_WIDTH - VIEWPORT_MARGIN);

  // Prefer below the target; fall back to above; else pin within viewport.
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;
  let cardTop: number;
  let arrow: "up" | "down";
  if (spaceBelow >= cardHeight + CARD_GAP || spaceBelow >= spaceAbove) {
    cardTop = rect.bottom + CARD_GAP;
    arrow = "up";
  } else {
    cardTop = rect.top - cardHeight - CARD_GAP;
    arrow = "down";
  }
  cardTop = Math.min(Math.max(cardTop, VIEWPORT_MARGIN), vh - cardHeight - VIEWPORT_MARGIN);

  const arrowLeft = Math.min(Math.max(targetCenterX - cardLeft, 20), CARD_WIDTH - 20);
  return { cardTop, cardLeft, arrow, arrowLeft };
}

export function GuidedTour({
  open,
  steps,
  storageKey,
  onClose,
  onStepChange,
}: {
  open: boolean;
  steps: TourStep[];
  /** localStorage key that records a permanent "don't show again" opt-out. */
  storageKey: string;
  onClose: () => void;
  /** Fires with the active step index whenever the visible step changes (and
   *  when the tour opens), so the host can prepare that step's target — e.g.
   *  selecting a node so the detail panel exists to be spotlighted. */
  onStepChange?: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dontShow, setDontShow] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Reset to the first step whenever the tour is (re)opened.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setDontShow(false);
    }
  }, [open]);

  // Let the host prepare the active step's target (e.g. open the detail panel).
  useEffect(() => {
    if (open) onStepChange?.(index);
  }, [open, index, onStepChange]);

  const finish = useCallback(() => {
    if (dontShow) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Private-mode or storage-disabled: harmless, tour just shows again.
      }
    }
    onClose();
  }, [dontShow, storageKey, onClose]);

  // Measure the current target and position the card. Re-runs on step change,
  // scroll (capture: also catches the scrollable filter panel), and resize.
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    let retryTimer = 0;
    // A step's target may mount asynchronously — the detail panel only exists
    // after the host selects a node for this step. Retry briefly before
    // falling back to a centered card, so the spotlight lands once it appears.
    let retries = 0;

    const measure = () => {
      if (!step?.target) {
        setRect(null);
        setPlacement(centeredPlacement());
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        if (retries < 25) {
          retries += 1;
          retryTimer = window.setTimeout(measure, 60);
          return;
        }
        setRect(null);
        setPlacement(centeredPlacement());
        return;
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect(r);
        const cardHeight = cardRef.current?.offsetHeight ?? 220;
        setPlacement(computePlacement(r, cardHeight));
      });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(retryTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, index, step]);

  // Esc closes the tour; arrow keys page through it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" && !isLast) {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft" && !isFirst) {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isFirst, isLast, steps.length, finish]);

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, index]);

  if (!open || !placement) return null;

  const holeTop = rect ? rect.top - HOLE_PAD : 0;
  const holeLeft = rect ? rect.left - HOLE_PAD : 0;
  const holeWidth = rect ? rect.width + HOLE_PAD * 2 : 0;
  const holeHeight = rect ? rect.height + HOLE_PAD * 2 : 0;

  const backdrop = "rgba(15, 18, 32, 0.62)";

  return (
    <div className="fixed inset-0" style={{ zIndex: 9998 }} aria-live="polite">
      {rect ? (
        <>
          {/* Four panels frame the target, leaving a transparent spotlight hole
              that also blocks clicks on the rest of the page. */}
          <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: Math.max(holeTop, 0), background: backdrop }} />
          <div style={{ position: "fixed", top: holeTop + holeHeight, left: 0, width: "100vw", height: Math.max(window.innerHeight - (holeTop + holeHeight), 0), background: backdrop }} />
          <div style={{ position: "fixed", top: holeTop, left: 0, width: Math.max(holeLeft, 0), height: holeHeight, background: backdrop }} />
          <div style={{ position: "fixed", top: holeTop, left: holeLeft + holeWidth, width: Math.max(window.innerWidth - (holeLeft + holeWidth), 0), height: holeHeight, background: backdrop }} />
          {/* Highlight ring around the spotlight */}
          <div
            style={{
              position: "fixed",
              top: holeTop,
              left: holeLeft,
              width: holeWidth,
              height: holeHeight,
              border: "2px solid var(--primary)",
              borderRadius: 12,
              boxShadow: "0 0 0 3px rgba(60, 78, 214, 0.25)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: backdrop }} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        tabIndex={-1}
        className="fixed rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none"
        style={{ top: placement.cardTop, left: placement.cardLeft, width: CARD_WIDTH, zIndex: 10000 }}
      >
        {placement.arrow && (
          <div
            aria-hidden="true"
            className="absolute h-3 w-3 rotate-45 bg-popover ring-1 ring-foreground/10"
            style={
              placement.arrow === "up"
                ? { top: -6, left: placement.arrowLeft - 6, clipPath: "polygon(0 0, 100% 0, 0 100%)" }
                : { bottom: -6, left: placement.arrowLeft - 6, clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }
            }
          />
        )}

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Step {index + 1} of {steps.length}
            </span>
            <button
              type="button"
              onClick={finish}
              className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Skip
            </button>
          </div>

          <h3 className="text-base font-semibold text-foreground text-pretty">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>

          {/* Progress dots */}
          <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? "var(--primary)" : "var(--border)",
                }}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {isFirst ? (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
                />
                Don&apos;t show again
              </label>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  {isFirst ? "Start tour" : "Next"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
