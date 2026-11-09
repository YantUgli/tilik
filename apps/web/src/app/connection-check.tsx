"use client";

import { useCallback, useEffect, useState } from "react";
import { SAMPLE_CAPTION_REQUEST, getHealth, postCaption, resolveApiUrl, type ApiOutcome } from "@/lib/api";

// Diinline saat build oleh Next.js. Hanya URL publik; tidak ada secret di frontend.
const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

type State = { phase: "idle" } | { phase: "loading" } | { phase: "done"; outcome: ApiOutcome };

export function ConnectionCheck() {
  const [health, setHealth] = useState<State>({ phase: "loading" });
  const [caption, setCaption] = useState<State>({ phase: "idle" });

  const checkHealth = useCallback(async () => {
    setHealth({ phase: "loading" });
    setHealth({ phase: "done", outcome: await getHealth(API_URL) });
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const testCaption = async () => {
    setCaption({ phase: "loading" });
    setCaption({ phase: "done", outcome: await postCaption(API_URL, SAMPLE_CAPTION_REQUEST) });
  };

  return (
    <>
      <section className="card">
        <p className="muted">
          API: <code>{API_URL ?? "(NEXT_PUBLIC_API_URL kosong)"}</code>
        </p>
      </section>

      <section className="card">
        <div className="row">
          <h2>Status /health</h2>
          <button type="button" onClick={checkHealth} disabled={health.phase === "loading"}>
            Cek ulang
          </button>
        </div>
        <Result state={health} okLabel={okHealthLabel} />
      </section>

      <section className="card">
        <div className="row">
          <h2>/analyze/caption</h2>
          <button type="button" onClick={testCaption} disabled={caption.phase === "loading"}>
            Uji caption
          </button>
        </div>
        <p className="muted">
          Mengirim caption contoh: <code>{SAMPLE_CAPTION_REQUEST.caption}</code>
        </p>
        <Result state={caption} okLabel={() => "Respons valid terhadap kontrak."} />
      </section>
    </>
  );
}

function okHealthLabel(body: unknown) {
  const { status, version } = body as { status: string; version: string };
  return `Status: ${status} (versi ${version}). Respons valid terhadap kontrak.`;
}

function Result({ state, okLabel }: { state: State; okLabel: (body: unknown) => string }) {
  if (state.phase === "idle") return null;
  if (state.phase === "loading") return <p className="muted">Menghubungi API…</p>;

  const { outcome } = state;
  switch (outcome.kind) {
    case "not_configured":
    case "unreachable":
      return (
        <p className="status error" role="alert">
          {outcome.message}
        </p>
      );
    case "http_error":
      return (
        <>
          <p className="status error" role="alert">
            {outcome.message}
          </p>
          <RawJson body={outcome.body} />
        </>
      );
    case "invalid":
      return (
        <>
          <p className="status warn" role="alert">
            {outcome.message}
          </p>
          <ul className="errors">
            {outcome.errors.map((e) => (
              <li key={e}>
                <code>{e}</code>
              </li>
            ))}
          </ul>
          <RawJson body={outcome.body} />
        </>
      );
    case "ok":
      return (
        <>
          <p className="status ok">{okLabel(outcome.body)}</p>
          <RawJson body={outcome.body} />
        </>
      );
  }
}

function RawJson({ body }: { body: unknown }) {
  return <pre className="json">{typeof body === "string" ? body : JSON.stringify(body, null, 2)}</pre>;
}
