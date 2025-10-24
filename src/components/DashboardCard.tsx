import { type ReactNode } from "react";

type DashboardCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function DashboardCard({ title, description, action, children, className }: DashboardCardProps) {
  const combinedClassName = [
    "flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/40 backdrop-blur",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={combinedClassName}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-white/70">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}
