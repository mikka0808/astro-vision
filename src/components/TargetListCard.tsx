import { motion } from "framer-motion";
import AltitudeMini from "./AltitudeMini";

export type TargetListCardProps = {
  name: string;
  catalogue: string;
  maxAltitude: string;
  maxAltitudeTime: string;
  grade: "A" | "B" | "C";
  moonSafe: boolean;
  favorite?: boolean;
  altitudeSamples?: number[];
};

export default function TargetListCard({
  name,
  catalogue,
  maxAltitude,
  maxAltitudeTime,
  grade,
  moonSafe,
  favorite = false,
  altitudeSamples,
}: TargetListCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-primary/40 hover:bg-primary/10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">{catalogue}</p>
          <h3 className="text-lg font-semibold text-white">{name}</h3>
        </div>
        <motion.span
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: favorite ? 1.1 : 1, rotate: favorite ? 0 : -10 }}
          transition={{ type: "spring", stiffness: 240, damping: 12 }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border px-2 text-lg ${
            favorite
              ? "border-secondary/60 bg-secondary/20 text-secondary"
              : "border-white/20 bg-white/10 text-white/60"
          }`}
          aria-hidden={!favorite}
        >
          ⭐
        </motion.span>
      </header>
      <div className="flex items-center gap-4 text-sm text-white/70">
        <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-secondary">
          Alt. max {maxAltitude}
        </span>
        <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-primary">
          Vers {maxAltitudeTime}
        </span>
        <span className="ml-auto rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80">
          Note {grade}
        </span>
      </div>
      {moonSafe ? (
        <p className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">
          🌙 Lune &lt; 25° — cible protégée des reflets
        </p>
      ) : null}
      {altitudeSamples ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-widest text-white/50">Courbe d'altitude</p>
          <AltitudeMini samples={altitudeSamples} />
        </div>
      ) : null}
    </article>
  );
}
