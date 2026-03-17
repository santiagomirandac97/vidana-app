
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'dark' | 'white';
  className?: string;
}

export function Logo({ variant = 'dark', className }: LogoProps) {
  const src = variant === 'white' ? '/logos/Logo N+.png' : '/logos/logo.png';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src={src}
        alt="Vidana"
        width={120}
        height={40}
        className="object-contain"
        priority
      />
    </div>
  );
}
