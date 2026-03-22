"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets, useLoginWithPasskey, useSignupWithPasskey } from "@privy-io/react-auth";

interface Proposal {
  id: number;
  question: string;
  options: string[];
  results: number[];
  totalWeight: number;
  endTime: number;
  active: boolean;
  started: boolean;
}

export default function Home() {
  const { logout, authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const { signupWithPasskey, state: signupState } = useSignupWithPasskey();
  const { loginWithPasskey, state: loginState } = useLoginWithPasskey();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const walletAddress = wallets?.[0]?.address;

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProposals();
    const interval = setInterval(fetchProposals, 5000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  const handleVote = async (proposalId: number, optionIndex: number) => {
    if (!authenticated || !user) {
      try { await loginWithPasskey(); } catch { /* user cancelled */ }
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          userId: user.id,
          voterAddress: walletAddress || user?.wallet?.address || null,
          proposalId,
          optionIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Vote cast! Weight: ${data.weight} 🧠`);
      fetchProposals();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Vote failed", "error");
    }
    setLoading(false);
  };

  const handleDelete = async (proposalId: number) => {
    if (!confirm("Delete this proposal?")) return;
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", proposalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Proposal deleted");
      fetchProposals();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          <span className="gradient-text">Neural Quorum</span>
          <br />
          <span style={{ color: "var(--text-primary)" }}>Governance</span>
        </h1>
        <p className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
          Voting power from <strong>reputation</strong>, not tokens. Delegate to a <strong>quorum</strong>, not one person.
        </p>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Authenticate with passkey. Vote on-chain on Monad.
        </p>

        {!authenticated ? (
          <div className="flex gap-3 justify-center">
            <button
              className="btn-glow"
              onClick={() => signupWithPasskey().catch(() => {})}
              disabled={signupState.status !== "initial"}
            >
              {signupState.status !== "initial" ? (
                <span className="flex items-center gap-2"><span className="spinner" style={{width:16,height:16}} /> Creating...</span>
              ) : "🔐 Create Passkey"}
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "12px 24px" }}
              onClick={() => loginWithPasskey().catch(() => {})}
              disabled={loginState.status !== "initial"}
            >
              {loginState.status !== "initial" ? (
                <span className="flex items-center gap-2"><span className="spinner" style={{width:16,height:16}} /> Signing in...</span>
              ) : "👆 Login with Passkey"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <span className="tier-badge tier-newcomer">
              🧠 {user?.wallet?.address ? `${user.wallet.address.slice(0, 8)}...` : "Connected"}
            </span>

            {walletAddress && (
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}
            <button onClick={logout} className="text-sm" style={{ color: "var(--text-muted)" }}>
              Logout
            </button>
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="glass-card p-6 mb-8" style={{ cursor: "default" }}>
        <h2 className="text-lg font-bold mb-4 gradient-text">How Neural Governance Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: "var(--bg-secondary)" }}>🏷️</div>
            <h3 className="font-semibold text-sm">Reputation Tier</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Newcomer (1) → Contributor (3) → Expert (5) → Admin (8)
            </p>
          </div>
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: "var(--bg-secondary)" }}>📊</div>
            <h3 className="font-semibold text-sm">Voting History</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              +1 per past vote, up to 5. Consistent voters gain power.
            </p>
          </div>
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: "var(--bg-secondary)" }}>👥</div>
            <h3 className="font-semibold text-sm">Quorum Delegation</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Delegate to 3-5 people. Your vote follows the majority.
            </p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <code className="text-sm px-4 py-2 rounded-lg inline-block" style={{ background: "var(--bg-secondary)", color: "var(--accent-light)" }}>
            votePower = tierScore + min(votesParticipated, 5)
          </code>
        </div>
      </section>

      {/* Active Proposals */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Active Proposals</h2>
          <a href="/create" className="btn-glow text-sm" style={{ padding: "8px 16px" }}>
            + New Proposal
          </a>
        </div>

        {proposals.length === 0 ? (
          <div className="glass-card p-8 text-center" style={{ cursor: "default" }}>
            <p className="text-3xl mb-2">🗳️</p>
            <p style={{ color: "var(--text-secondary)" }}>No proposals yet. Create the first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onVote={handleVote}
                onDelete={handleDelete}
                loading={loading}
                isLoggedIn={authenticated}
              />
            ))}
          </div>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  onVote,
  onDelete,
  loading,
  isLoggedIn,
}: {
  proposal: Proposal;
  onVote: (proposalId: number, optionIndex: number) => void;
  onDelete: (proposalId: number) => void;
  loading: boolean;
  isLoggedIn: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const timeLeft = proposal.endTime * 1000 - Date.now();
  const isActive = timeLeft > 0;

  const getStatusLabel = () => {
    if (isActive) {
      const h = Math.floor(timeLeft / 3600000);
      const m = Math.floor((timeLeft % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    }
    return "Ended";
  };

  const statusClass = isActive ? "tier-expert" : "tier-newcomer";

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold flex-1">{proposal.question}</h3>
        <span className={`text-xs px-3 py-1 rounded-full ${statusClass}`}>
          {getStatusLabel()}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {proposal.options.map((opt, i) => {
          const pct = proposal.totalWeight > 0
            ? Math.round((proposal.results[i] / proposal.totalWeight) * 100)
            : 0;

          return (
            <div key={i}>
              <button
                className={`vote-option flex justify-between items-center ${selected === i ? "selected" : ""}`}
                onClick={() => {
                  setSelected(i);
                  if (isActive) onVote(proposal.id, i);
                }}
                disabled={loading || !isActive || !isLoggedIn}
              >
                <span>{opt}</span>
                <span className="text-sm font-mono" style={{ color: "var(--accent-light)" }}>
                  {pct}% ({proposal.results[i]} wt)
                </span>
              </button>
              <div className="vote-bar mt-1">
                <div className="vote-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-xs" style={{ color: "var(--text-muted)" }}>
        <span>Total weight: {proposal.totalWeight}</span>
        <div className="flex items-center gap-3">
          <span>Proposal #{proposal.id}</span>
          <button
            onClick={() => onDelete(proposal.id)}
            className="text-xs px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
            style={{ color: "#ef4444" }}
            title="Delete proposal"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
