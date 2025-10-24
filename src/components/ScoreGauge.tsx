import { useEffect, useRef } from "react";
import {
  ArcElement,
  Chart,
  ChartData,
  ChartOptions,
  Legend,
  Tooltip,
} from "chart.js";

Chart.register(ArcElement, Tooltip, Legend);
Chart.defaults.color = "#E5E5E5";
Chart.defaults.font.family = "Inter, system-ui, -apple-system, sans-serif";
Chart.defaults.font.size = 12;

const BASE_OPTIONS: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "78%",
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(11, 12, 16, 0.9)",
      borderColor: "rgba(74, 95, 234, 0.6)",
      borderWidth: 1,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 12,
      displayColors: false,
    },
  },
};

type ScoreGaugeProps = {
  score: number;
  label: string;
  subLabel?: string;
};

export default function ScoreGauge({ score, label, subLabel }: ScoreGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"doughnut"> | null>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const data: ChartData<"doughnut"> = {
      labels: ["Score", "Reste"],
      datasets: [
        {
          data: [score, Math.max(0, 100 - score)],
          backgroundColor: ["#3AE8B8", "rgba(255, 255, 255, 0.08)"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };

    if (chartRef.current) {
      chartRef.current.data = data;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(context, {
      type: "doughnut",
      data,
      options: {
        ...BASE_OPTIONS,
        animation: { duration: 900, easing: "easeOutQuart" },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [score]);

  return (
    <div className="relative flex h-56 w-full flex-col items-center justify-center sm:h-64 md:h-72">
      <canvas
        ref={canvasRef}
        aria-label={`Score global: ${score}/100`}
        role="img"
        className="h-full w-full"
      />
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-semibold text-secondary">{score}</span>
        <span className="mt-1 text-sm text-white/70">{label}</span>
        {subLabel ? <span className="text-xs text-white/50">{subLabel}</span> : null}
      </div>
    </div>
  );
}
