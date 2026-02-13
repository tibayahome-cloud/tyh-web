import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { ChevronRight, Check } from "lucide-react";
import classNames from "classnames";

interface SlideToBookProps {
  onConfirm: () => void;
  isLoading?: boolean;
  label?: string;
  successLabel?: string;
}

export const SlideToBook = ({
  onConfirm,
  isLoading = false,
  label = "Slide to Book",
  successLabel = "Booking..."
}: SlideToBookProps) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const controls = useAnimation();
  
  // Transform x position to opacity for labels
  const opacity = useTransform(x, [0, 150], [1, 0]);
  const iconOpacity = useTransform(x, [0, 50], [1, 0.3]);

  useEffect(() => {
    if (isSuccess && !isLoading) {
      // Logic for post-success handle if needed
    }
  }, [isSuccess, isLoading]);

  const handleDragEnd = (_: any, info: any) => {
    const threshold = (constraintsRef.current?.offsetWidth ?? 300) * 0.7;
    
    if (info.point.x > threshold || info.offset.x > threshold) {
      setIsSuccess(true);
      controls.start({ x: (constraintsRef.current?.offsetWidth ?? 300) - 60 });
      onConfirm();
    } else {
      controls.start({ x: 0 });
    }
  };

  return (
    <div 
      ref={constraintsRef}
      className={classNames(
        "relative h-16 w-full overflow-hidden rounded-full p-1 transition-colors duration-300",
        isSuccess ? "bg-emerald-500" : "bg-neutral-100"
      )}
    >
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <span className="text-sm font-bold text-neutral-500 tracking-wide uppercase">
          {label}
        </span>
      </motion.div>

      {isSuccess && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-white tracking-wide uppercase">
            {successLabel}
          </span>
        </div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: (constraintsRef.current?.offsetWidth ?? 300) - 60 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className={classNames(
          "relative z-10 flex h-14 w-14 cursor-grab items-center justify-center rounded-full shadow-lg transition-colors active:cursor-grabbing",
          isSuccess ? "bg-white text-emerald-500" : "bg-brand-600 text-white"
        )}
      >
        {isSuccess ? (
          <Check className="h-6 w-6" />
        ) : (
          <motion.div style={{ opacity: iconOpacity }}>
            <ChevronRight className="h-6 w-6" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
