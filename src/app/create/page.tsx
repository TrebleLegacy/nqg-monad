"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function CreateProposal() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(3600);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    proposalId?: number;
    txHash?: string;
    ipfsHash?: string | null;
    ipfsUrl?: string | null;
    error?: string;
  } | null>(null);

  const walletAddress = wallets?.[0]?.address;

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      setResult({ error: "Question and at least 2 options required" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          creatorAddress: walletAddress,
          question: question.trim(),
          options: validOptions,
          duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({
        proposalId: data.proposalId,
        txHash: data.txHash,
        ipfsHash: data.ipfsHash,
        ipfsUrl: data.ipfsUrl,
      });
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
            Proposal #{result.proposalId} is now live on Monad
          </p>
          {result.txHash && (
            <a
              href={`https://monadscan.com/tx/${result.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm block"
              style={{ color: "var(--accent-light)" }}
            >
              View on MonadScan ↗
            </a>
          )}
          {result.ipfsUrl && (
            <a
              href={result.ipfsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm block mt-2"
              style={{ color: "var(--accent-light)" }}
            >
              📌 Pinned on IPFS ↗
            </a>
          )}
          {result.ipfsHash && (
            <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>
              CID: {result.ipfsHash}
            </p>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/" className="btn-glow text-sm">← Back to Proposals</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto fade-in">
      <h1 className="text-3xl font-bold mb-6 gradient-text">Create Proposal</h1>

      <div className="glass-card p-6" style={{ cursor: "default" }}>
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
                <button onClick={() => removeOption(i)} className="px-3 text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={addOption} className="text-sm" style={{ color: "var(--accent-light)" }}>+ Add option</button>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Duration</label>
          <select className="input-dark" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={300}>5 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
          </select>
        </div>

        {result?.error && (
          <p className="text-sm mb-4" style={{ color: "#ef4444" }}>❌ {result.error}</p>
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
