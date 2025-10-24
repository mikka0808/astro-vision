import DashboardCard from "../components/DashboardCard";
import ScoreGauge from "../components/ScoreGauge";
import WeatherCard from "../components/WeatherCard";
import TargetListCard from "../components/TargetListCard";

const TARGETS = [
  {
    name: "Nébuleuse d'Orion",
    catalogue: "Messier 42",
    maxAltitude: "58°",
    maxAltitudeTime: "22h14",
    grade: "A" as const,
    moonSafe: true,
    favorite: true,
    altitudeSamples: [22, 28, 36, 44, 55, 62, 58],
  },
  {
    name: "Galaxie du Sombrero",
    catalogue: "Messier 104",
    maxAltitude: "41°",
    maxAltitudeTime: "01h37",
    grade: "B" as const,
    moonSafe: false,
    favorite: false,
    altitudeSamples: [18, 24, 31, 39, 44, 37, 28],
  },
  {
    name: "Amas d'Hercule",
    catalogue: "Messier 13",
    maxAltitude: "72°",
    maxAltitudeTime: "03h05",
    grade: "A" as const,
    moonSafe: true,
    favorite: false,
    altitudeSamples: [30, 41, 55, 68, 72, 66, 50],
  },
];

export default function DashboardPage() {
  return (
    <>
      <DashboardCard
        title="Score de la nuit"
        description="Synthèse des critères météo et qualité du ciel"
        className="sm:col-span-2 lg:col-span-1"
      >
        <div className="flex items-center justify-center">
          <ScoreGauge score={87} label="Excellente nuit" subLabel="Fenêtre optimale entre 22h et 03h" />
        </div>
      </DashboardCard>
      <DashboardCard
        title="Conditions atmosphériques"
        description="Prévisions horaires locales"
        className="sm:col-span-2 lg:col-span-2"
      >
        <WeatherCard transparence="8 / 10" seeing="7 / 10" phase="Lune 32%" />
      </DashboardCard>
      <DashboardCard
        title="Fenêtres d'observation"
        description="Planifiez vos sessions"
        className="lg:col-span-1"
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold text-white">22h00 → 23h45</p>
            <p className="text-xs text-white/60">Voie lactée haute, vent stable &lt; 10 km/h</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold text-white">01h30 → 03h30</p>
            <p className="text-xs text-white/60">Seeing calme pour la galaxie du Sombrero</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold text-white">Avant l'aube</p>
            <p className="text-xs text-white/60">Consacrez 40 min à Jupiter et ses bandes</p>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard
        title="Cibles recommandées"
        description="Triées selon vos préférences et la hauteur sur l'horizon"
        className="sm:col-span-2 lg:col-span-2"
      >
        <div className="grid gap-3">
          {TARGETS.map((target) => (
            <TargetListCard key={target.name} {...target} />
          ))}
        </div>
      </DashboardCard>
      <DashboardCard
        title="Journal de session"
        description="Gardez la trace de vos mesures rapides"
        className="lg:col-span-1"
      >
        <div className="flex flex-col gap-4 text-sm text-white/70">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span>Alignement polaire</span>
            <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-secondary">± 2'</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span>Équilibrage monture</span>
            <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-primary">OK</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span>Dark frames</span>
            <span className="rounded-full border border-warn/30 bg-warn/15 px-3 py-1 text-warn">À faire</span>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard
        title="Notes rapides"
        description="Vos actions à ne pas oublier"
        className="sm:col-span-2 lg:col-span-1"
      >
        <ul className="space-y-3 text-sm text-white/70">
          <li className="flex items-center justify-between">
            <span>Mettre à jour la bibliothèque de darks</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">Rappel 19h30</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Tester la nouvelle caméra planétaire</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">Setup nomade</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Réviser la collimation</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">Avant minuit</span>
          </li>
        </ul>
      </DashboardCard>
    </>
  );
}
