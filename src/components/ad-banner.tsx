import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT } from "@/lib/site-config";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** The one and only ad placement on the site: a banner at the top of public pages. */
export function AdBanner() {
  const pushed = useRef(false);
  const enabled = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      s.src = src;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers can throw; ignore */
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="border-b border-border bg-muted/60">
      <div className="mx-auto max-w-5xl px-4 py-2">
        <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Advertisement
        </p>
        <ins
          className="adsbygoogle block min-h-[90px] w-full"
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
