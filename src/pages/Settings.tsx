import DashboardCard from "../components/DashboardCard";

export default function SettingsPage() {
  return (
    <>
      <DashboardCard
        title="Préférences d'observation"
        description="Adaptez les recommandations à votre setup"
        className="sm:col-span-2"
      >
        <form className="space-y-4 text-sm text-white/70">
          <label className="flex flex-col gap-2">
            Équipement principal
            <select className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white">
              <option>Newton 150/750</option>
              <option>Lunette 80ED</option>
              <option>RC 8"</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            Filtre par défaut
            <select className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white">
              <option>Dual Band (Ha + OIII)</option>
              <option>LRGB</option>
              <option>Hα étroit</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span>Activer le mode session rapide</span>
            <input type="checkbox" className="h-5 w-5 accent-secondary" defaultChecked />
          </label>
        </form>
      </DashboardCard>
      <DashboardCard title="Confidentialité" description="Contrôlez vos données locales" className="lg:col-span-1">
        <div className="space-y-3 text-sm text-white/70">
          <p>
            Les préférences et favoris sont sauvegardés dans votre navigateur via localStorage. Aucun envoi vers un serveur externe
            n'est réalisé.
          </p>
          <button
            type="button"
            className="w-full rounded-full border border-warn/30 bg-warn/15 px-4 py-2 text-sm font-medium text-warn transition hover:bg-warn/25"
          >
            Effacer les données locales
          </button>
          <p className="text-xs text-white/50">
            Consentement cookies: uniquement pour mémoriser l'accord d'installation PWA.
          </p>
        </div>
      </DashboardCard>
    </>
  );
}
