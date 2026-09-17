import { BRAND_LOGO_SRC, BRAND_NAME } from '../brand';
import { cn } from '../utils/format';

const sizes = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-[4.75rem]',
  hero: 'h-36 sm:h-44',
} as const;

export function BrandLogo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof sizes;
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_NAME}
      draggable={false}
      className={cn('w-auto max-w-full object-contain select-none', sizes[size], className)}
    />
  );
}
