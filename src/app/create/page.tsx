"use client";

import { useState, useMemo } from "react";

function toLocalInput(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateProposal() {
  const defaults = useMemo(() => {
    const start = Math.floor(Date.now() / 1000) + 300;
    const end = start + 3600;
    return { start, end };
  }, []);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [startLocal, setStartLocal] = useState(() => toLocalInput(defaults.start));
  const [endLocal, setEndLocal] = useState(() => toLocalInput(defaults.end));
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ proposalId?: number; txHash?: string; error?: string } | null>(null);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      setResult({ error: "Question and at least 2 options required" });
      return;
    }
    if (!adminSecret.trim()) {
      setResult({ error: "Admin secret required (ADMIN_SECRET from server env)" });
      return;
    }

    const startTime = Math.floor(new Date(startLocal).getTime() / 1000);
    const endTime = Math.floor(new Date(endLocal).getTime() / 1000);
    if (!(startTime > 0 && endTime > startTime)) {
      setResult({ error: "End time must be after start time" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          adminSecret: adminSecret.trim(),
          question: question.trim(),
          options: validOptions,
          startTime,
          endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ proposalId: data.proposalId, txHash: data.txHash });
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : "Failed to create" });
    }
    setLoading(false);
  };

  if (result?.proposalId !== undefined) {
    return (
      <div className="text-center fade-in">
        <div className="glass-card p-8 max-w-md mx-auto" style={{ cursor: "default" }}>
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-2xl font-bold mb-2 gradient-text">Proposal Created!</h2>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Proposal #{result.proposalId} is scheduled on Monad
          </p>
          {result.txHash && (
            <a
              href={`https://testnet.monadscan.com/tx/${result.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm"
              style={{ color: "var(--accent-light)" }}
            >
              View on Monadscan ↗
            </a>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/" className="btn-glow text-sm">
              ← Back to Proposals
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto fade-in">
      <h1 className="text-3xl font-bold mb-2 gradient-text">Create Proposal</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Only the protocol admin can create polls. Voting opens and closes at the times you set.
      </p>

      <div className="glass-card p-6" style={{ cursor: "default" }}>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Admin secret</label>
          <input
            type="password"
            className="input-dark"
            placeholder="ADMIN_SECRET from .env.local"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Question</label>
          <input
            type="text"
            className="input-dark"
            placeholder="What should we decide?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Options</label>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text"
                className="input-dark flex-1"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const newOpts = [...options];
                  newOpts[i] = e.target.value;
                  setOptions(newOpts);
                }}
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(i)}
                  className="px-3 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={addOption} className="text-sm" style={{ color: "var(--accent-light)" }}>
              + Add option
            </button>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Voting opens (local time)</label>
            <input
              type="datetime-local"
              className="input-dark"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Voting closes (local time)</label>
            <input
              type="datetime-local"
              className="input-dark"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </div>
        </div>

        {result?.error && (
          <p className="text-sm mb-4" style={{ color: "#ef4444" }}>
            ❌ {result.error}
          </p>
        )}

        <button className="btn-glow w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" /> Creating on Monad...
            </span>
          ) : (
            "🗳️ Create Proposal"
          )}
        </button>
      </div>
    </div>
  );
}
