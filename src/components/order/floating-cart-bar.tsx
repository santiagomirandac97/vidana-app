'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useCart } from '@/context/cart-context';

export function FloatingCartBar() {
  const router = useRouter();
  const cart = useCart();
  const controls = useAnimation();
  const prevCount = useRef(cart.totalItems);

  // Bounce animation when item count changes
  useEffect(() => {
    if (cart.totalItems !== prevCount.current && cart.totalItems > 0) {
      controls.start({
        scale: [1, 1.06, 1],
        transition: { duration: 0.3 },
      });
    }
    prevCount.current = cart.totalItems;
  }, [cart.totalItems, controls]);

  return (
    <AnimatePresence>
      {cart.totalItems > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 md:bottom-4 left-0 right-0 z-40 mx-4 flex justify-center pointer-events-none"
        >
          <motion.button
            animate={controls}
            onClick={() => router.push('/order/cart')}
            className="pointer-events-auto flex items-center gap-3 bg-primary text-white rounded-2xl shadow-xl px-6 py-3.5 w-full max-w-md hover:bg-primary/90 transition-colors"
          >
            <ShoppingBag size={20} />
            <span className="flex-1 text-left font-medium">
              {cart.totalItems} {cart.totalItems === 1 ? 'articulo' : 'articulos'}
            </span>
            <span className="font-mono font-semibold">
              ${cart.totalAmount.toFixed(2)}
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
