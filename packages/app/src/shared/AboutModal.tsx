import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import disclaimerText from "../../src-tauri/installer/phi-disclaimer.txt?raw";

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        // Running outside Tauri (e.g. browser dev preview) -- keep the
        // compiled-in fallback rather than surfacing an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const paragraphs = disclaimerText.trim().split(/\n\s*\n/);

  return (
    <div className="about-backdrop" onClick={onClose}>
      <div
        className="about-modal"
        role="dialog"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="about-header">
          <div className="about-header-titles">
            <span className="about-title" id="about-title">About paste7</span>
            <span className="caption caption--accent">v{version}</span>
          </div>
          <button type="button" className="about-close" onClick={onClose} aria-label="Close">
            ×&nbsp;close
          </button>
        </header>

        <div className="about-body">
          <p className="about-tagline">
            Lightweight desktop scratchpad for inspecting healthcare interop messages with PHI auto-redaction.
          </p>

          <div className="about-disclaimer">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <footer className="about-footer">
          MIT License · Copyright (c) 2026 paste7 contributors
        </footer>
      </div>
    </div>
  );
}
