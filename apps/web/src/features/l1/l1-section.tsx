"use client";

import { useState } from "react";
import { PhotoInput, type PreparedInput } from "@/features/input/photo-input";
import { L1Card } from "./l1-card";

/** Integrasi minimal T-12: L1 jalan saat "Periksa" ditekan. T-23 akan merangkai semua kartu hasil. */
export function L1Section() {
  const [input, setInput] = useState<PreparedInput | null>(null);
  return (
    <>
      <PhotoInput onSubmit={setInput} />
      {input && <L1Card file={input.file} images={input.images} />}
    </>
  );
}
