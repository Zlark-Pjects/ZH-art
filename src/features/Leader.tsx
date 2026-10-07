import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const SEEN_KEY = "zh-art:leader-seen";

function shouldPlay() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

/** Film-leader countdown shown once per session. Click or any key skips it. */
export function Leader() {
  const [visible, setVisible] = useState(shouldPlay);
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode: the leader just plays again next time */
    }
    const timers = [
      setTimeout(() => setCount(2), 450),
      setTimeout(() => setCount(1), 900),
      setTimeout(() => setVisible(false), 1400),
    ];
    const skip = () => setVisible(false);
    window.addEventListener("keydown", skip);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", skip);
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="leader"
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center bg-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
          onClick={() => setVisible(false)}
          aria-hidden
        >
          <div className="grain absolute inset-0" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-fg/15" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-fg/15" />
          <svg viewBox="0 0 100 100" className="absolute h-[64vmin] w-[64vmin] -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(237 234 227 / 0.15)" strokeWidth="0.4" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgb(237 234 227 / 0.1)" strokeWidth="0.4" />
            <motion.circle
              key={count}
              cx="50"
              cy="50"
              r="23"
              fill="none"
              stroke="#ffb224"
              strokeOpacity="0.22"
              strokeWidth="46"
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.45, ease: "linear" }}
            />
          </svg>
          <motion.span
            key={`n${count}`}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative font-display text-[30vmin] leading-none text-fg"
          >
            {count}
          </motion.span>
          <span className="eyebrow absolute bottom-8 left-1/2 -translate-x-1/2">ZH—ART · click to skip</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
