'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── CSS Confetti ────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF9FF3', '#F8A5C2', '#63CDDA', '#F7D794',
  '#778BEB', '#E77F67', '#CF6A87', '#A3CB38',
];

const CONFETTI_COUNT = 40;

function generateConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 6 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * 360,
  }));
}

const confettiKeyframes = `
@keyframes confetti-fall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(720deg);
    opacity: 0;
  }
}
`;

// ─── Component ───────────────────────────────────────────────────────────────

interface OrderSuccessProps {
  orderNumber: string;
  onDismiss: () => void;
}

export function OrderSuccess({ orderNumber, onDismiss }: OrderSuccessProps) {
  const router = useRouter();
  const [confetti] = useState(generateConfetti);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
      >
        {/* Confetti CSS */}
        <style>{confettiKeyframes}</style>

        {/* Confetti dots */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${c.left}%`,
              top: '-10px',
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              animation: `confetti-fall ${c.duration}s ${c.delay}s ease-in forwards`,
              transform: `rotate(${c.rotation}deg)`,
            }}
          />
        ))}

        {/* Content */}
        <div className="flex flex-col items-center text-center px-6 relative z-10">
          {/* Check icon with scale-in */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <CheckCircle className="w-20 h-20 text-green-500" strokeWidth={1.5} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold mt-6"
          >
            {'\u00A1'}Tu orden ha sido recibida!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-4xl font-mono font-bold mt-4 text-primary"
          >
            #{orderNumber}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-muted-foreground text-sm mt-3"
          >
            {`Confirmaci\u00F3n enviada a tu correo`}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            className="flex flex-col gap-3 mt-8 w-full max-w-xs"
          >
            <Button
              size="lg"
              className="w-full rounded-xl"
              onClick={() => {
                onDismiss();
                router.push('/order/orders');
              }}
            >
              Ver mis {'\u00F3'}rdenes
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl"
              onClick={() => {
                onDismiss();
                router.push('/order');
              }}
            >
              Ordenar m{'\u00E1'}s
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
