"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Gatilho = "mount" | "hover" | "scroll" | "loop";
type ModoPreenchimento = "wipe" | "fade" | "none";

interface Caixa {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextoTracadoProps {
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  drawDuration?: number;
  fillDelay?: number;
  stagger?: number;
  ease?: string;
  trigger?: Gatilho;
  fillMode?: ModoPreenchimento;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  reverse?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * Altura pelo próprio viewBox em vez de `fontSize * 1.3` fixo. Sem isto o
   * SVG reserva altura de mais e sobra vazio dentro da moldura da marca.
   */
  alturaAutomatica?: boolean;
}

/**
 * Texto que se desenha: o traço corre pelo contorno e o preenchimento entra
 * depois. Porte em TypeScript do componente StrokeText (GSAP).
 *
 * O contorno é um `<text>` com dasharray animado; o preenchimento é um segundo
 * `<text>` por cima, revelado por clip-path (wipe) ou opacidade (fade).
 */
export function TextoTracado({
  text = "AFROPUNK",
  strokeColor = "var(--ink)",
  fillColor = "var(--ink)",
  strokeWidth = 1.4,
  drawDuration = 1.6,
  fillDelay = 0.2,
  stagger = 0.05,
  ease = "power2.out",
  trigger = "mount",
  fillMode = "wipe",
  fontSize = 128,
  fontWeight = 900,
  letterSpacing = -4,
  reverse = false,
  className = "",
  style = {},
  alturaAutomatica = false,
}: TextoTracadoProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const strokeTextRef = useRef<SVGTextElement>(null);
  const wipeRectRef = useRef<SVGRectElement>(null);

  const [box, setBox] = useState<Caixa | null>(null);

  const rawId = useId();
  const wipeId = `traco-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const caracteres = useMemo(() => Array.from(String(text ?? "")), [text]);

  const dash = Math.max(fontSize * 7, 200);

  const estiloFonte: CSSProperties = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      fontWeight,
      letterSpacing: `${letterSpacing}px`,
      // A fonte do dashboard; sem isto o SVG cairia na fonte padrão do sistema
      // e a medição do bbox sairia com outra métrica.
      fontFamily: "var(--fonte-inter), system-ui, sans-serif",
    }),
    [fontSize, fontWeight, letterSpacing],
  );

  // Mede o texto para montar o viewBox. Refaz quando as fontes carregam:
  // medir antes disso dá a métrica da fonte de fallback.
  useLayoutEffect(() => {
    if (!strokeTextRef.current) return undefined;
    let cancelado = false;

    const medir = () => {
      if (cancelado || !strokeTextRef.current) return;
      let bbox: DOMRect;
      try {
        bbox = strokeTextRef.current.getBBox();
      } catch {
        return;
      }
      if (!bbox || !bbox.width) return;

      const folga = Math.max(Number(strokeWidth) || 1, fontSize * 0.1);
      const proxima: Caixa = {
        x: bbox.x - folga,
        y: bbox.y - folga,
        width: bbox.width + folga * 2,
        height: bbox.height + folga * 2,
      };

      setBox((anterior) =>
        anterior &&
        Math.abs(anterior.x - proxima.x) < 0.5 &&
        Math.abs(anterior.width - proxima.width) < 0.5 &&
        Math.abs(anterior.y - proxima.y) < 0.5
          ? anterior
          : proxima,
      );
    };

    medir();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(medir).catch(() => {});
    }

    return () => {
      cancelado = true;
    };
  }, [caracteres, fontSize, fontWeight, letterSpacing, strokeWidth]);

  useEffect(() => {
    const root = rootRef.current;
    if (typeof window === "undefined" || !root || !box) return undefined;

    const tracos = gsap.utils.toArray<SVGTSpanElement>(
      root.querySelectorAll("[data-traco]"),
    );
    const preenchimentos = gsap.utils.toArray<SVGTSpanElement>(
      root.querySelectorAll("[data-preenchimento]"),
    );
    const wipe = wipeRectRef.current;
    if (!tracos.length) return undefined;

    const preencher = fillMode !== "none";
    const usarWipe = preencher && fillMode === "wipe";
    const duracaoPreenchimento = Math.max(0.4, drawDuration * 0.5);
    const escalonar: number | gsap.StaggerVars = reverse
      ? { each: stagger, from: "end" }
      : stagger;
    const alvos: Element[] = [...tracos, ...preenchimentos, wipe].filter(
      (e): e is SVGTSpanElement | SVGRectElement => Boolean(e),
    );

    const noInicio = () => {
      gsap.killTweensOf(alvos);
      gsap.set(tracos, { strokeDasharray: dash, strokeDashoffset: dash });
      gsap.set(preenchimentos, { opacity: usarWipe ? 1 : 0 });
      if (wipe) gsap.set(wipe, { attr: { width: 0 } });
    };

    const noFim = () => {
      gsap.killTweensOf(alvos);
      gsap.set(tracos, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(preenchimentos, { opacity: preencher ? 1 : 0 });
      if (wipe) gsap.set(wipe, { attr: { width: preencher ? box.width : 0 } });
    };

    // Quem pediu menos movimento vê o estado final, sem animação.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      noFim();
      return () => gsap.killTweensOf(alvos);
    }

    const montar = () => {
      noInicio();
      const tl = gsap.timeline({
        paused: true,
        repeat: trigger === "loop" ? -1 : 0,
        repeatDelay: trigger === "loop" ? 0.9 : 0,
        defaults: { overwrite: "auto" },
      });

      tl.to(
        tracos,
        { strokeDashoffset: 0, duration: drawDuration, ease, stagger: escalonar },
        0,
      );

      if (usarWipe && wipe) {
        tl.to(
          wipe,
          { attr: { width: box.width }, duration: duracaoPreenchimento, ease: "power2.inOut" },
          drawDuration + fillDelay,
        );
      } else if (preencher) {
        tl.to(
          preenchimentos,
          {
            opacity: 1,
            duration: duracaoPreenchimento,
            ease: "power2.out",
            stagger: escalonar,
          },
          drawDuration + fillDelay,
        );
      }

      return tl;
    };

    let timeline: gsap.core.Timeline | null = null;
    let scrollTrigger: ScrollTrigger | null = null;
    let removerHover: (() => void) | null = null;

    if (trigger === "hover") {
      noFim();
      const tocar = () => {
        timeline?.kill();
        timeline = montar();
        timeline.play(0);
      };
      root.addEventListener("pointerenter", tocar);
      removerHover = () => root.removeEventListener("pointerenter", tocar);
    } else {
      timeline = montar();
      if (trigger === "scroll") {
        scrollTrigger = ScrollTrigger.create({
          trigger: root,
          start: "top 82%",
          once: true,
          onEnter: () => timeline?.play(0),
        });
      } else {
        timeline.play(0);
      }
    }

    return () => {
      removerHover?.();
      scrollTrigger?.kill();
      timeline?.kill();
      gsap.killTweensOf(alvos);
    };
  }, [box, dash, drawDuration, fillDelay, stagger, ease, trigger, fillMode, reverse]);

  const viewBox = box
    ? `${box.x} ${box.y} ${box.width} ${box.height}`
    : `0 ${-fontSize} 600 ${fontSize * 1.3}`;

  return (
    <span
      ref={rootRef}
      className={`block w-full leading-[0] ${trigger === "hover" ? "cursor-pointer" : ""} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={String(text ?? "")}
    >
      <svg
        className="block w-full"
        style={alturaAutomatica ? { height: "auto" } : { height: `${Math.round(fontSize * 1.3)}px` }}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {fillMode === "wipe" && box && (
          <defs>
            <clipPath id={wipeId} clipPathUnits="userSpaceOnUse">
              <rect ref={wipeRectRef} x={box.x} y={box.y} width="0" height={box.height} />
            </clipPath>
          </defs>
        )}

        <text
          ref={strokeTextRef}
          className="select-none"
          x="0"
          y="0"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={estiloFonte}
        >
          {caracteres.map((c, i) => (
            <tspan data-traco key={`t-${i}`}>
              {c}
            </tspan>
          ))}
        </text>

        <text
          className="select-none"
          x="0"
          y="0"
          fill={fillColor}
          stroke="none"
          style={estiloFonte}
          clipPath={fillMode === "wipe" && box ? `url(#${wipeId})` : undefined}
        >
          {caracteres.map((c, i) => (
            <tspan data-preenchimento key={`p-${i}`}>
              {c}
            </tspan>
          ))}
        </text>
      </svg>
    </span>
  );
}

export default TextoTracado;
