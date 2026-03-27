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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
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

        {/* Content card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl mx-6 p-8 flex flex-col items-center text-center relative z-10 max-w-sm w-full"
        >
          {/* Check icon with scale-in */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
            className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center"
          >
            <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={1.5} />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-muted-foreground mt-5"
          >
            Tu orden ha sido recibida
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-3xl font-mono font-bold mt-2 text-primary"
          >
            #{orderNumber}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="text-muted-foreground text-sm mt-3"
          >
            {`Confirmaci\u00F3n enviada a tu correo`}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col gap-3 mt-8 w-full"
          >
            <Button
              size="lg"
              className="w-full rounded-full"
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
              className="w-full rounded-full"
              onClick={() => {
                onDismiss();
                router.push('/order');
              }}
            >
              Seguir ordenando
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
