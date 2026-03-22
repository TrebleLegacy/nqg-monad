"use client";

import { useState, useEffect, useCallback } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

interface Proposal {
  id: number;
  question: string;
  options: string[];
  results: number[];
  totalWeight: number;
  endTime: number;
  active: boolean;
}

interface UserInfo {
  username: string;
  sessionId: string;
  evmAddress: string;
}

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Check saved session
    const saved = localStorage.getItem("nqg_user");
    if (saved) setUser(JSON.parse(saved));
    fetchProposals();
    const interval = setInterval(fetchProposals, 5000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  const handleRegister = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      // Step 1: Get registration options
      const startRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "start", username: username.trim() }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);

      // Step 2: Create passkey
      const attestation = await startRegistration({ optionsJSON: startData.options });

      // Step 3: Complete registration
      const completeRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "complete",
          attestation,
          challenge: startData.options.challenge,
          userId: startData.userId,
          username: username.trim(),
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error);

      const userInfo = {
        username: completeData.username,
        sessionId: completeData.sessionId,
        evmAddress: completeData.evmAddress,
      };
      setUser(userInfo);
      localStorage.setItem("nqg_user", JSON.stringify(userInfo));
      setShowAuth(false);
      showToast("Registered successfully! 🎉");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Registration failed", "error");
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const startRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "start" }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);

      const assertion = await startAuthentication({ optionsJSON: startData.options });

      const completeRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "complete",
          assertion,
          challenge: startData.options.challenge,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error);

      const userInfo = {
        username: completeData.username,
        sessionId: completeData.sessionId,
        evmAddress: completeData.evmAddress,
      };
      setUser(userInfo);
      localStorage.setItem("nqg_user", JSON.stringify(userInfo));
      setShowAuth(false);
      showToast("Logged in! 👋");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Login failed", "error");
    }
    setLoading(false);
  };

  const handleVote = async (proposalId: number, optionIndex: number) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          sessionId: user.sessionId,
          proposalId,
          optionIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Vote cast! Weight applied by your reputation 🧠");
      fetchProposals();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Vote failed", "error");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("nqg_user");
  };

  const tierLabels = ["Newcomer", "Contributor", "Expert", "Admin"];
  const tierClasses = ["tier-newcomer", "tier-contributor", "tier-expert", "tier-admin"];

  return (
    <div className="fade-in">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          <span className="gradient-text">Neural Quorum</span>
          <br />
          <span style={{ color: 'var(--text-primary)' }}>Governance</span>
        </h1>
        <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
          Voting power from <strong>reputation</strong>, not tokens. Delegate to a <strong>quorum</strong>, not one person.
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Authenticate with passkey (biometrics). Vote anonymously on-chain on Monad.
        </p>

        {!user ? (
          <div className="flex gap-3 justify-center">
            <button className="btn-glow" onClick={() => { setAuthMode("register"); setShowAuth(true); }}>
              🔐 Register with Passkey
            </button>
            <button className="btn-secondary" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>
              Sign In
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <span className="tier-badge tier-newcomer">🧠 {user.username}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {user.evmAddress.slice(0, 8)}...
            </span>
            <button onClick={handleLogout} className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Logout
            </button>
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="glass-card p-6 mb-8" style={{ cursor: 'default' }}>
        <h2 className="text-lg font-bold mb-4 gradient-text">How Neural Governance Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: 'var(--bg-secondary)' }}>🏷️</div>
            <h3 className="font-semibold text-sm">Reputation Tier</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Newcomer (1) → Contributor (3) → Expert (5) → Admin (8)
            </p>
          </div>
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: 'var(--bg-secondary)' }}>📊</div>
            <h3 className="font-semibold text-sm">Voting History</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              +1 per past vote, up to 5. Consistent voters gain power.
            </p>
          </div>
          <div className="text-center">
            <div className="neuron-node mx-auto mb-2" style={{ background: 'var(--bg-secondary)' }}>👥</div>
            <h3 className="font-semibold text-sm">Quorum Delegation</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Delegate to 3-5 people. Your vote follows the majority.
            </p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <code className="text-sm px-4 py-2 rounded-lg inline-block" style={{ background: 'var(--bg-secondary)', color: 'var(--accent-light)' }}>
            votePower = tierScore + min(votesParticipated, 5)
          </code>
        </div>
      </section>

      {/* Active Proposals */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Active Proposals</h2>
          <a href="/create" className="btn-glow text-sm" style={{ padding: '8px 16px' }}>
            + New Proposal
          </a>
        </div>

        {proposals.length === 0 ? (
          <div className="glass-card p-8 text-center" style={{ cursor: 'default' }}>
            <p className="text-3xl mb-2">🗳️</p>
            <p style={{ color: 'var(--text-secondary)' }}>No proposals yet. Create the first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onVote={handleVote}
                loading={loading}
                isLoggedIn={!!user}
              />
            ))}
          </div>
        )}
      </section>

      {/* Auth Modal */}
      {showAuth && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowAuth(false)}
        >
          <div
            className="glass-card p-8 w-full max-w-md fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4 gradient-text">
              {authMode === "register" ? "Create Account" : "Sign In"}
            </h2>
            
            {authMode === "register" ? (
              <div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Choose a username. Your passkey (fingerprint/FaceID) will be your login.
                </p>
                <input
                  type="text"
                  placeholder="Username"
                  className="input-dark mb-4"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
                <button
                  className="btn-glow w-full"
                  onClick={handleRegister}
                  disabled={loading || !username.trim()}
                >
                  {loading ? <span className="spinner inline-block" /> : "🔐 Register with Passkey"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Use your passkey (fingerprint/FaceID) to sign in.
                </p>
                <button
                  className="btn-glow w-full"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? <span className="spinner inline-block" /> : "🔐 Sign In with Passkey"}
                </button>
              </div>
            )}

            <p className="text-center mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              {authMode === "register" ? (
                <button onClick={() => setAuthMode("login")} style={{ color: 'var(--accent-light)' }}>
                  Already have an account? Sign in
                </button>
              ) : (
                <button onClick={() => setAuthMode("register")} style={{ color: 'var(--accent-light)' }}>
                  New here? Create account
                </button>
              )}
            </p>
          </div>
        </div>
      )}

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
  loading,
  isLoggedIn,
}: {
  proposal: Proposal;
  onVote: (proposalId: number, optionIndex: number) => void;
  loading: boolean;
  isLoggedIn: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const maxVotes = Math.max(...proposal.results, 1);
  const timeLeft = proposal.endTime * 1000 - Date.now();
  const isActive = timeLeft > 0;

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Ended";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold flex-1">{proposal.question}</h3>
        <span className={`text-xs px-3 py-1 rounded-full ${isActive ? 'tier-expert' : 'tier-newcomer'}`}>
          {formatTime(timeLeft)}
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
                onClick={() => { setSelected(i); if (isActive) onVote(proposal.id, i); }}
                disabled={loading || !isActive || !isLoggedIn}
              >
                <span>{opt}</span>
                <span className="text-sm font-mono" style={{ color: 'var(--accent-light)' }}>
                  {pct}% ({proposal.results[i]} weight)
                </span>
              </button>
              <div className="vote-bar mt-1">
                <div className="vote-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Total weight: {proposal.totalWeight}</span>
        <span>Proposal #{proposal.id}</span>
      </div>
    </div>
  );
}
