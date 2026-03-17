
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'dark' | 'white';
  className?: string;
}

export function Logo({ variant = 'dark', className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src={variant === 'white' ? '/logos/vidana-white.png' : '/logos/vidana-color.png'}
        alt="Vidana"
        width={140}
        height={48}
        className="object-contain"
        priority
      />
    </div>
  );
}
