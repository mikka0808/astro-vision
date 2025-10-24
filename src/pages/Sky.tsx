import DashboardCard from "../components/DashboardCard";
import SkyMapFOV from "../components/SkyMapFOV";

export default function SkyPage() {
  return (
    <>
      <DashboardCard
        title="Carte interactive du ciel"
        description="Ajustez le champ pour visualiser vos capteurs en direct"
        className="sm:col-span-2"
        action={
          <button
            type="button"
            className="rounded-full border border-secondary/30 bg-secondary/15 px-4 py-2 text-sm font-medium text-secondary transition hover:bg-secondary/25"
          >
            Centrer sur la cible
          </button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <SkyMapFOV />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="text-xs uppercase tracking-widest text-white/50">Orientation</p>
              <p className="text-base font-semibold text-white">Nord-Est (45°)</p>
              <p>Hauteur : 52° • Azimut : 70°</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="text-xs uppercase tracking-widest text-white/50">Temps restant</p>
              <p className="text-base font-semibold text-white">2h 18</p>
              <p>Avant passage sous 30°</p>
            </div>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard title="Outils d'observation" description="Réglez votre montage pour un suivi précis" className="lg:col-span-1">
        <div className="space-y-4 text-sm text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Cadence de poses</p>
            <p className="text-base font-semibold text-white">180 s</p>
            <p>SNR cible à 78% • Gain 120</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Focale effective</p>
            <p className="text-base font-semibold text-white">630 mm</p>
            <p>Réducteur 0.85× appliqué</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Guidage</p>
            <p className="text-base font-semibold text-white">RMS 0.54"</p>
            <p>Ajuster l'agressivité RA si vent &gt; 15 km/h</p>
          </div>
        </div>
      </DashboardCard>
    </>
  );
}
