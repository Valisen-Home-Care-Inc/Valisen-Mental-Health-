"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=2560&q=85&auto=format&fit=crop",
    alt: "Young seedlings sprouting in soft natural light",
  },
  {
    src: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=2560&q=85&auto=format&fit=crop",
    alt: "Person walking in nature",
  },
  {
    src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=2560&q=85&auto=format&fit=crop",
    alt: "Peaceful meditation in morning light",
  },
  {
    src: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=2560&q=85&auto=format&fit=crop",
    alt: "Calm natural scene with plants",
  },
  {
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2560&q=85&auto=format&fit=crop",
    alt: "Sunrise over a peaceful landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?w=2560&q=85&auto=format&fit=crop",
    alt: "Lush green forest path",
  },
];

export default function ImageSlideshow({ height = 190 }: { height?: number }) {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % SLIDES.length);
        setFading(false);
      }, 400);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SLIDES[current].src}
        alt={SLIDES[current].alt}
        className="h-full w-full object-cover"
        style={{
          opacity: fading ? 0 : 1,
          transition: "opacity 0.4s ease-in-out",
        }}
      />
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setCurrent(i)}
            className="h-1.5 w-1.5 rounded-full transition-colors"
            style={{ background: i === current ? "#fff" : "rgba(255,255,255,0.45)" }}
          />
        ))}
      </div>
    </div>
  );
}
