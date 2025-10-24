import { Cloud, Eye, Moon } from "lucide-react";

export type WeatherCardProps = {
  transparence: string;
  seeing: string;
  phase: string;
};

export default function WeatherCard({ transparence, seeing, phase }: WeatherCardProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <Cloud className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">Transparence</p>
          <p className="text-lg font-semibold text-white">{transparence}</p>
          <p className="text-xs text-white/60">Nuages hauts dissipés</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Eye className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">Seeing</p>
          <p className="text-lg font-semibold text-white">{seeing}</p>
          <p className="text-xs text-white/60">Turbulences modérées</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warn/15 text-warn">
          <Moon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">Phase lunaire</p>
          <p className="text-lg font-semibold text-white">{phase}</p>
          <p className="text-xs text-white/60">Éblouissement limité</p>
        </div>
      </div>
    </div>
  );
}
