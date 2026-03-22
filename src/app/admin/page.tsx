"use client";

import { useState } from "react";

const TIERS = ["Newcomer (1)", "Contributor (3)", "Expert (5)", "Admin (8)"];

export default function AdminPanel() {
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState(0);
  const [proposalId, setProposalId] = useState("");
  const [result, setResult] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const show = (msg: string, type: "success" | "error" = "success") => {
    setResult({ msg, type });
    setTimeout(() => setResult(null), 4000);
  };

  const approveVoter = async () => {
    if (!address.trim()) return show("Address required", "error");
    setLoading(true);
    try {
      const res = await fetch("/api/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", address: address.trim(), tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      show(`✅ Approved ${address.slice(0, 8)}... as ${TIERS[tier]}`);
      setAddress("");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Failed", "error");
    }
    setLoading(false);
  };

  const startVoting = async () => {
    if (proposalId === "") return show("Proposal ID required", "error");
    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "startVoting", proposalId: Number(proposalId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      show(`🗳️ Voting started for Proposal #${proposalId}!`);
      setProposalId("");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Failed", "error");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto fade-in">
      <h1 className="text-3xl font-bold mb-2 gradient-text">Admin Panel</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Manage voters and control voting. Only the contract owner can perform these actions.
      </p>

      {/* Approve Voter */}
      <div className="glass-card p-6 mb-6" style={{ cursor: "default" }}>
        <h2 className="text-lg font-bold mb-4">Approve Voter</h2>
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">Wallet Address</label>
          <input
            type="text"
            className="input-dark"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Reputation Tier</label>
          <select className="input-dark" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {TIERS.map((t, i) => (
              <option key={i} value={i}>{t}</option>
            ))}
          </select>
        </div>
        <button className="btn-glow w-full" onClick={approveVoter} disabled={loading}>
          {loading ? "Approving..." : "✅ Approve Voter"}
        </button>
      </div>

      {/* Start Voting */}
      <div className="glass-card p-6 mb-6" style={{ cursor: "default" }}>
        <h2 className="text-lg font-bold mb-4">Start Voting</h2>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Proposal ID</label>
          <input
            type="number"
            className="input-dark"
            placeholder="0"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
          />
        </div>
        <button className="btn-glow w-full" onClick={startVoting} disabled={loading}>
          {loading ? "Starting..." : "🚀 Start Voting"}
        </button>
      </div>

      {result && (
        <div className={`toast ${result.type === "success" ? "toast-success" : "toast-error"}`}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
