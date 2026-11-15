"use client";

import { useEffect, useId, useRef } from "react";
import { DISCLAIMER } from "./consent";

type Props = { onConfirm: () => void; onCancel: () => void };

/** Dialog modal inline (FR-UI-03). Fokus awal ke tombol utama; Esc = Batal. */
export function DisclaimerDialog({ onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
    }
    confirmRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="card disclaimer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Esc: tutup lewat state, bukan oleh browser
        onCancel();
      }}
    >
      <h2 id={titleId}>{DISCLAIMER.title}</h2>
      {DISCLAIMER.paragraphs.map((parts, i) => (
        <p key={i}>
          {parts.map((part, j) => (part.strong ? <strong key={j}>{part.text}</strong> : <span key={j}>{part.text}</span>))}
        </p>
      ))}
      <div className="disclaimer-actions">
        <button type="button" ref={confirmRef} onClick={onConfirm}>
          {DISCLAIMER.confirm}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          {DISCLAIMER.cancel}
        </button>
      </div>
    </dialog>
  );
}
