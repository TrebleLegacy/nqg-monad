# NQG on Monad — Neural Quorum Governance

> **Reputation-based anonymous voting with passkey authentication on Monad L1.**

Ported from [Stellar's Neural Quorum Governance](https://stellar.gitbook.io/scf-handbook/governance/neural-quorum-governance) — a production-proven governance mechanism used by the Stellar Community Fund since 2023.

## 🧠 What is NQG?

Traditional DAO voting (1-token-1-vote) creates plutocracy. NQG fixes this with two innovations:

### Neural Governance
Your voting power comes from **reputation**, not wallet size:
- **Tier Neuron**: Newcomer (1) → Contributor (3) → Expert (5) → Admin (8)
- **History Neuron**: +1 per past vote, capped at 5
- **Formula**: `votePower = tierScore + min(votesParticipated, 5)`

### Quorum Delegation
Delegate to **3-5 people**, not just one:
- Your vote auto-follows the quorum majority
- Reduces centralization and collusion risk
- Solves voter fatigue without sacrificing representation

### Privacy
- Authenticate with **passkey** (fingerprint/FaceID) — no MetaMask, no seed phrase
- Votes relayed by server hot wallet — on-chain, all votes appear from same address
- Nobody can link your identity to your vote

## 🏗️ Architecture

```
Browser (Passkey Auth)  →  Next.js API (Session + Relay)  →  Monad Chain (NQGVoting.sol)
```

- **Auth**: WebAuthn passkeys via `@simplewebauthn`
- **Privacy**: Server validates identity, relays votes via hot wallet
- **On-chain**: Neural score calculated in contract, weighted votes recorded
- **Chain**: Monad Testnet (Chain ID 10143)

## 🚀 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Auth | WebAuthn / Passkeys |
| Backend | Next.js API Routes |
| Contract | Solidity 0.8.24, Hardhat |
| Chain | Monad Testnet (10143) |

## 📦 Setup

```bash
# Install dependencies
npm install

# Set env vars
cp .env.local.example .env.local
# Edit: DEPLOYER_PRIVATE_KEY, NEXT_PUBLIC_CONTRACT_ADDRESS

# Compile contract
npx hardhat compile --config hardhat.config.cjs

# Deploy to Monad
npx hardhat run scripts/deploy.cjs --network monad --config hardhat.config.cjs

# Run dev server
npm run dev
```

## 🎯 Inspired By

- [Stellar Community Fund — NQG](https://stellar.gitbook.io/scf-handbook/governance/neural-quorum-governance)
- [BlockScience — Neural Quorum Governance Paper](https://block.science/)
- [Monad — High-Performance EVM L1](https://monad.xyz)

## 📄 License

MIT

---

Built at **Monad Blitz São Paulo 2026** 🇧🇷
