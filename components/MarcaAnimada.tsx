"use client";

import { TextoTracado } from "./TextoTracado";

/**
 * Wordmark AFROPUNK que se desenha na entrada.
 *
 * A ordem é a do pôster: primeiro o traço corre pelas letras, o branco entra
 * por trás dele, e só então a moldura fecha em volta e o "2026" aparece. Os
 * atrasos são encadeados à mão porque a moldura e o ano são HTML — não fazem
 * parte da timeline do SVG.
 */

const DESENHO = 1.4; // duração do traço
const ATRASO_PREENCHIMENTO = 0.15;
const FIM_PREENCHIMENTO = DESENHO + ATRASO_PREENCHIMENTO + DESENHO * 0.5;

export function MarcaAnimada({ largura = 196 }: { largura?: number }) {
  return (
    <span className="flex flex-col items-center gap-2">
      <span
        className="marca-entra moldura relative inline-block px-4 py-2"
        style={{
          animation: `moldura-fecha 0.5s ease-out ${DESENHO * 0.72}s both`,
        }}
      >
        <span className="block" style={{ width: largura }}>
          <TextoTracado
            text="AFROPUNK"
            strokeColor="var(--ink)"
            fillColor="var(--ink)"
            strokeWidth={1.1}
            fontSize={110}
            fontWeight={900}
            letterSpacing={-5}
            drawDuration={DESENHO}
            fillDelay={ATRASO_PREENCHIMENTO}
            stagger={0.045}
            fillMode="wipe"
            trigger="mount"
            alturaAutomatica
          />
        </span>

        {/* ® fica fora do SVG: dentro dele viria no corpo das letras. */}
        <span
          className="marca-entra absolute right-[5px] top-[6px] text-[var(--fs-micro)] font-bold leading-none text-[var(--ink)]"
          style={{ animation: `surgir 0.4s ease-out ${FIM_PREENCHIMENTO}s both` }}
          aria-hidden="true"
        >
          ®
        </span>
      </span>

      <span
        className="marca-entra text-[var(--fs-corpo)] font-semibold leading-none tracking-[0.42em] text-[var(--ink-2)] pl-[0.42em]"
        style={{ animation: `surgir 0.5s ease-out ${FIM_PREENCHIMENTO + 0.1}s both` }}
      >
        2026
      </span>
    </span>
  );
}
