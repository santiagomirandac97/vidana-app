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
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="fixed md:bottom-4 left-0 right-0 z-40 flex justify-center px-6 pointer-events-none"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <motion.button
            animate={controls}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/order/cart')}
            className="pointer-events-auto flex items-center gap-3 bg-primary text-white rounded-full shadow-xl px-6 py-3.5 max-w-sm w-full hover:bg-primary/90 transition-colors"
          >
            <div className="relative">
              <ShoppingBag size={20} />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-white text-primary text-[10px] font-bold">
                {cart.totalItems}
              </span>
            </div>
            <span className="flex-1 text-left font-medium text-sm">
              Ver carrito
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
