
import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image 
        src="/logos/logo.png" 
        alt="Company Logo" 
        width={120} 
        height={40} 
        className="object-contain"
        priority
      />
    </div>
  );
}
