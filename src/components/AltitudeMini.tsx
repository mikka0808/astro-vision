import { useEffect, useRef } from "react";
import {
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const OPTIONS: ChartOptions<"line"> = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      display: false,
      suggestedMin: 0,
      suggestedMax: 90,
    },
  },
  elements: {
    line: {
      tension: 0.35,
      borderWidth: 2,
      fill: "start",
    },
    point: {
      radius: 0,
    },
  },
};

type AltitudeMiniProps = {
  samples: number[];
};

export default function AltitudeMini({ samples }: AltitudeMiniProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const labels = samples.map((_, index) => `${index}`);
    const data: ChartData<"line"> = {
      labels,
      datasets: [
        {
          data: samples,
          borderColor: "#4B5FEA",
          backgroundColor: "rgba(75, 95, 234, 0.22)",
        },
      ],
    };

    if (chartRef.current) {
      chartRef.current.data = data;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(context, {
      type: "line",
      data,
      options: OPTIONS,
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [samples]);

  return <canvas ref={canvasRef} className="h-20 w-full" aria-hidden />;
}
