import { useState } from "react";

const poster = "/media/gosie-promo-poster.jpg";

export function PromoVideo() {
  const [started, setStarted] = useState(false);

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-cream/15 bg-ink shadow-float">
      {started ? (
        <video
          aria-label="Gosie promotional video"
          autoPlay
          controls
          playsInline
          preload="auto"
          poster={poster}
          className="aspect-video w-full bg-ink"
        >
          <source src="/media/gosie-promo.mp4" type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      ) : (
        <button
          type="button"
          aria-label="Play the Gosie promotional video"
          onClick={() => setStarted(true)}
          className="group relative block aspect-video w-full overflow-hidden text-cream focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-peach"
        >
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/75 pl-1 transition-transform group-hover:scale-105"
            style={{ backgroundColor: "rgba(24, 55, 47, 0.95)" }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="#ffffff" />
            </svg>
          </span>
          <span className="absolute bottom-3 right-3 rounded-lg bg-ink/90 px-3 py-2 text-xs font-semibold">
            Play the promo
          </span>
        </button>
      )}
    </div>
  );
}
