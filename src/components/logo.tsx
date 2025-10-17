import { Utensils } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Utensils className="h-8 w-8 text-primary" />
      <h1 className="text-2xl font-bold text-foreground">
        Reception<span className="text-primary">RGSTR</span>
      </h1>
    </div>
  );
}
