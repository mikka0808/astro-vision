import { useEffect, useMemo, useRef, useState } from "react";

type Star = {
  x: number;
  y: number;
  magnitude: number;
};

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let index = 0; index < count; index += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      magnitude: Math.random(),
    });
  }
  return stars;
}

type SkyMapFOVProps = {
  label?: string;
};

export default function SkyMapFOV({ label = "Champ simulé" }: SkyMapFOVProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [scale, setScale] = useState(1);
  const stars = useMemo(() => generateStars(180), []);

  const rotationRef = useRef(rotation);
  const mirroredRef = useRef(mirrored);
  const scaleRef = useRef(scale);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let frameId: number;

    const render = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);

      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.2
      );
      gradient.addColorStop(0, "rgba(58, 232, 184, 0.15)");
      gradient.addColorStop(1, "rgba(11, 12, 16, 0.95)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(width / 2, height / 2);
      context.rotate((rotationRef.current * Math.PI) / 180);
      const effectiveScale = scaleRef.current;
      context.scale(mirroredRef.current ? -effectiveScale : effectiveScale, effectiveScale);

      stars.forEach((star) => {
        const x = (star.x - 0.5) * width;
        const y = (star.y - 0.5) * height;
        const size = Math.max(1, 3 - star.magnitude * 2.5);
        const opacity = 0.4 + star.magnitude * 0.6;
        context.fillStyle = `rgba(229, 229, 229, ${opacity.toFixed(2)})`;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
      });

      context.restore();

      frameId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(devicePixelRatio, devicePixelRatio);
    };

    handleResize();
    render();

    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [stars]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    const values = { rotation: 0, scale: 1, mirror: 1 };
    const targets = { rotation, scale, mirror: mirrored ? -1 : 1 };

    let frameId: number;

    const animate = () => {
      targets.rotation = rotationRef.current;
      targets.scale = scaleRef.current;
      targets.mirror = mirroredRef.current ? -1 : 1;

      values.rotation += (targets.rotation - values.rotation) * 0.2;
      values.scale += (targets.scale - values.scale) * 0.2;
      values.mirror += (targets.mirror - values.mirror) * 0.2;

      overlay.style.transform = `translateZ(0) rotate(${values.rotation.toFixed(2)}deg) scale(${(
        values.scale * values.mirror
      ).toFixed(3)}, ${values.scale.toFixed(3)})`;

      frameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold text-white/80">
          {label}
        </span>
        <span>Rotation : {rotation.toFixed(0)}°</span>
        <span>Mise à l'échelle : {(scale * 100).toFixed(0)}%</span>
        <span>Mirroir : {mirrored ? "activé" : "désactivé"}</span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0e1630]">
        <canvas ref={canvasRef} className="h-[50dvh] w-full sm:h-[60dvh]" />
        <svg
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full will-change-transform"
          viewBox="0 0 600 450"
          role="presentation"
          style={{ transformOrigin: "50% 50%" }}
        >
          <rect
            x="190"
            y="135"
            width="220"
            height="165"
            rx="20"
            ry="20"
            fill="none"
            stroke="rgba(74, 95, 234, 0.9)"
            strokeDasharray="18 14"
            strokeWidth="4"
          />
          <circle
            cx="300"
            cy="225"
            r="12"
            fill="rgba(58, 232, 184, 0.6)"
            stroke="rgba(58, 232, 184, 0.9)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex flex-col text-white/70">
          Rotation
          <input
            type="range"
            min="0"
            max="360"
            value={rotation}
            onChange={(event) => setRotation(Number(event.target.value))}
            className="mt-2 w-40 accent-primary"
          />
        </label>
        <label className="flex flex-col text-white/70">
          Échelle
          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.1"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="mt-2 w-40 accent-secondary"
          />
        </label>
        <label className="flex items-center gap-2 text-white/70">
          <input
            type="checkbox"
            checked={mirrored}
            onChange={(event) => setMirrored(event.target.checked)}
            className="h-5 w-5 rounded border-white/30 bg-white/10 text-secondary accent-secondary"
          />
          Inversion miroir
        </label>
      </div>
    </div>
  );
}
