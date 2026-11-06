type Props = {
  done: number;
  total: number;
  label: string;
};

/**
 * One segment per required document, filled as each is sent. The list is short and finite, so the bar shows exactly that:
 * three documents is three segments. Flat colour, no motion: it only changes when something has been sent.
 */
export const SegmentedProgress = ({ done, total, label }: Props) => {
  const count = Math.max(0, Math.min(total, 12));
  const filled = Math.max(0, Math.min(done, count));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(done, total)}>
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={`h-2.5 flex-1 rounded-full ${index < filled ? "bg-tiba-blue" : "bg-white ring-1 ring-inset ring-slate-300"}`} />
        ))}
      </div>
    </div>
  );
};
