"use client";

import { useCallback, useReducer, useRef, useState } from "react";
import { L1Card } from "@/features/l1/l1-card";
import { PhotoInput, type PreparedInput } from "@/features/input/photo-input";
import { analyzeCaption, resolveApiUrl } from "@/lib/api";
import { INCOMPLETE_NOTE, RISK_LABEL, computeRisk } from "@/lib/risk";
import type { LayerResult } from "@/lib/validate";
import { LayerCard } from "./layer-card";
import { SERVER_TITLES, initialSession, sessionReducer } from "./session";

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

/**
 * Alur M1: satu tombol "Periksa" memicu L1 (di perangkat) dan /analyze/caption (server).
 * Hasil tampil progresif per lapis; risiko akhir muncul setelah semua lapis selesai.
 */
export function Analyzer() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [input, setInput] = useState<PreparedInput | null>(null);
  const nextId = useRef(0);

  const onSubmit = useCallback((inp: PreparedInput) => {
    const id = ++nextId.current;
    setInput(inp);
    dispatch({ type: "submit", id });
    // OCR baru ada di T-13 → ocr_text null. Respons untuk id lama diabaikan reducer.
    analyzeCaption(API_URL, inp.caption, null).then((result) => dispatch({ type: "server", id, result }));
  }, []);

  const onChange = useCallback(() => {
    setInput(null);
    dispatch({ type: "reset" });
  }, []);

  const id = session.id;
  const onL1 = useCallback((result: LayerResult) => dispatch({ type: "l1", id, result }), [id]);

  const server = session.server;
  const serverLayers: (LayerResult | null)[] = server ? server.layers : [null, null, null];
  const all = session.l1 && server ? [session.l1, ...server.layers] : null;
  const risk = all ? computeRisk(all) : null;

  return (
    <>
      <PhotoInput onSubmit={onSubmit} onChange={onChange} />

      {input && id !== 0 && (
        <div className="results">
          <section className={`card risk-card ${risk ? `risk-${risk.level}` : ""}`} aria-live="polite">
            <h2>Risiko akhir</h2>
            {risk ? (
              <p className="risk-level">
                <strong>{RISK_LABEL[risk.level]}</strong>
                {risk.incomplete && <span className="status warn"> · {INCOMPLETE_NOTE}</span>}
              </p>
            ) : (
              <p className="muted">Sedang dianalisis…</p>
            )}
            {server?.problem === "busy" && <p className="status warn">{server.message}</p>}
          </section>

          <L1Card key={id} file={input.file} images={input.images} onResult={onL1} />

          {serverLayers.map((layer, i) => (
            <LayerCard key={`${id}-${i}`} title={SERVER_TITLES[i]} layer={layer} busy={server?.problem === "busy"} />
          ))}
        </div>
      )}
    </>
  );
}
