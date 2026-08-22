import iconUrl from "/icons/icon-512.png?url";

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={iconUrl}
      alt="FARID AI logo"
      width={512}
      height={512}
      className={`${className} rounded-xl object-cover`}
    />
  );
}
