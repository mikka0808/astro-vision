import DashboardCard from "../components/DashboardCard";
import TargetListCard from "../components/TargetListCard";

const FAVORITES = [
  {
    name: "Nébuleuse de la Rosette",
    catalogue: "NGC 2237",
    maxAltitude: "49°",
    maxAltitudeTime: "23h05",
    grade: "A" as const,
    moonSafe: true,
    favorite: true,
    altitudeSamples: [26, 34, 42, 49, 53, 47, 38],
  },
  {
    name: "Galaxie d'Andromède",
    catalogue: "Messier 31",
    maxAltitude: "64°",
    maxAltitudeTime: "20h55",
    grade: "A" as const,
    moonSafe: true,
    favorite: true,
    altitudeSamples: [38, 48, 59, 64, 61, 52, 42],
  },
];

export default function FavoritesPage() {
  return (
    <>
      <DashboardCard title="Vos favoris" description="Synchronisés avec l'équipement sélectionné" className="sm:col-span-2">
        <div className="grid gap-3">
          {FAVORITES.map((target) => (
            <TargetListCard key={target.name} {...target} />
          ))}
        </div>
      </DashboardCard>
      <DashboardCard title="Fenêtre lunaire" description="Optimisez vos sessions selon l'altitude de la Lune" className="lg:col-span-1">
        <div className="space-y-3 text-sm text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Lune &lt; 25°</p>
            <p className="text-base font-semibold text-white">18h20 → 01h15</p>
            <p>Idéal pour les nébuleuses par émission.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Fenêtre large</p>
            <p className="text-base font-semibold text-white">02h → 05h30</p>
            <p>Ajoutez les galaxies Messier pour finir la nuit.</p>
          </div>
        </div>
      </DashboardCard>
    </>
  );
}
