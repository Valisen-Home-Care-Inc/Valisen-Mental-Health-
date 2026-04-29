type PhotoCardProps = {
  mood: string;
  src?: string;
  fallbackId?: number;
  bg?: string;
  className?: string;
  imageHeight?: number;
  alt?: string;
};

const CURATED_PHOTOS = [
  
  "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=2560&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=2560&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=2560&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1491147334573-44cbb4602074?w=2560&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2560&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?w=2560&q=85&auto=format&fit=crop",

];

export default function PhotoCard({
  mood,
  src,
  fallbackId = 1,
  bg = "#B5D4D4",
  className = "",
  imageHeight = 160,
  alt,
}: PhotoCardProps) {
  const imageSrc = src ?? CURATED_PHOTOS[(fallbackId - 1) % CURATED_PHOTOS.length];
  return (
    <div
      className={`rounded-[24px] p-3 ${className}`}
      style={{ background: bg }}
    >
      <div
        className="overflow-hidden rounded-[16px]"
        style={{ height: imageHeight }}
      >
        {/* Using a plain img for simplicity with picsum + arbitrary external sources */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt ?? `${mood} client photo`}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="badge-sage relative ml-2 -mt-2 inline-block">{mood}</span>
    </div>
  );
}
