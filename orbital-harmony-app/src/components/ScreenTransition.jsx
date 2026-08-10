import { motion, useReducedMotion } from 'motion/react';

/** Premium opacity-only transition for whole-screen swaps. */
export default function ScreenTransition({ children, screen }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="screen-transition"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: screen === 'system' ? 1.2 : 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
