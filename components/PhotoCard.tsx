type PhotoCardProps = {
  mood: string;
  src?: string;
  fallbackId?: number;
  bg?: string;
  className?: string;
  imageHeight?: number;
  alt?: string;
};

export default function PhotoCard({
  mood,
  src,
  fallbackId = 1,
  bg = "#B5D4D4",
  className = "",
  imageHeight = 160,
  alt,
}: PhotoCardProps) {
  const imageSrc = src ?? `https://picsum.photos/300/400?random=${fallbackId}`;
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
