export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src="/icons/icon-512.png"
      alt="FARID AI logo"
      width={512}
      height={512}
      className={`${className} rounded-xl object-cover`}
    />
  );
}
