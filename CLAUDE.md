# NQG on Monad — Neural Quorum Governance

## Project
Anonymous voting dApp with reputation-based voting power (Neural Quorum Governance) on Monad L1, with passkey (WebAuthn) authentication.

## Stack
- **Framework**: Next.js 15 (App Router, TypeScript, Tailwind)
- **Chain**: Monad Testnet (Chain ID 10143, RPC `https://testnet-rpc.monad.xyz`)
- **Contracts**: Solidity 0.8.x via Hardhat
- **Auth**: WebAuthn Passkeys (`@simplewebauthn/server` + `@simplewebauthn/browser`)
- **Web3**: ethers.js v6

## Architecture
- Server relays votes to contract via hot wallet (privacy: all votes come from same address)
- Passkeys for auth (no MetaMask needed)
- Neural score = tier_score + voting_history (on-chain)
- Quorum delegation: delegate to 3-5 people, auto-vote follows majority

## Key Files
- `contracts/NQGVoting.sol` — Main voting contract
- `src/app/api/auth/` — Passkey registration/login
- `src/app/api/proposals/` — Proposal CRUD + voting
- `src/app/page.tsx` — Landing + active proposals
- `src/app/proposal/[id]/page.tsx` — Vote + results
- `src/app/create/page.tsx` — Create proposal

## Monad Specifics
- Contract address: set in `.env.local` NEXT_PUBLIC_CONTRACT_ADDRESS
- Deployer/relayer: DEPLOYER_PRIVATE_KEY in `.env.local`
- Faucet: https://faucet.monad.xyz
