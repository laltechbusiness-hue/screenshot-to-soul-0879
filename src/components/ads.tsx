import { useEffect, useRef, useState } from "react";
import {
  ADSENSE_CLIENT,
  ADSENSE_SLOT_BOTTOM,
  ADSENSE_SLOT_LEFT,
  ADSENSE_SLOT_RIGHT,
} from "@/lib/site-config";
import { adPlacementFor, SIDE_AD_HEIGHT, SIDE_AD_WIDTH, type AdPlacement } from "@/lib/ad-layout";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function loadAdsenseScript() {
  const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

/** One AdSense unit. Only mounted when visible, so Google never receives a zero-width slot. */
function AdUnit({ slot, className, style, format }: { slot: string; className?: string; style?: React.CSSProperties; format?: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    loadAdsenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers can throw; ignore */
    }
  }, []);
  return (
    <ins
      className={`adsbygoogle block ${className ?? ""}`}
      style={style}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      {...(format ? { "data-ad-format": format, "data-full-width-responsive": "true" } : {})}
    />
  );
}

function useAdPlacement() {
  const [placement, setPlacement] = useState<AdPlacement | null>(null);
  useEffect(() => {
    const update = () => setPlacement(adPlacementFor(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return placement;
}

function Label() {
  return <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">Advertisement</p>;
}

/**
 * Wide screens: one ad in the empty space on each side of the page, never over content.
 * Phones and tablets: a single ad at the bottom of the page, above the footer (not floating).
 */
export function SiteAds({ position }: { position: "sides" | "bottom" }) {
  const placement = useAdPlacement();
  if (!ADSENSE_CLIENT || placement !== position) return null;

  if (position === "sides") {
    const rail = "fixed top-20 z-10 hidden min-[1440px]:block";
    const size = { width: SIDE_AD_WIDTH, height: SIDE_AD_HEIGHT };
    return (
      <>
        {ADSENSE_SLOT_LEFT && (
          <aside aria-label="Advertisement" className={`${rail} left-4`} style={{ width: SIDE_AD_WIDTH }}>
            <Label />
            <AdUnit slot={ADSENSE_SLOT_LEFT} style={size} />
          </aside>
        )}
        {ADSENSE_SLOT_RIGHT && (
          <aside aria-label="Advertisement" className={`${rail} right-4`} style={{ width: SIDE_AD_WIDTH }}>
            <Label />
            <AdUnit slot={ADSENSE_SLOT_RIGHT} style={size} />
          </aside>
        )}
      </>
    );
  }

  if (!ADSENSE_SLOT_BOTTOM) return null;
  return (
    <aside aria-label="Advertisement" className="mx-auto mt-12 w-full max-w-5xl px-4">
      <Label />
      <AdUnit slot={ADSENSE_SLOT_BOTTOM} className="min-h-[100px] w-full" format="horizontal" />
    </aside>
  );
}
