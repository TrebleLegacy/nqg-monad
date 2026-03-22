# NQG on Monad — Neural Quorum Governance

## Project
Anonymous voting dApp with reputation-based voting power (Neural Quorum Governance) on Monad L1, with Privy passkey authentication and IPFS proposal pinning.

## Stack
- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind v4)
- **Chain**: Monad Testnet (Chain ID 10143, RPC `https://testnet-rpc.monad.xyz`)
- **Contracts**: Solidity 0.8.x via Hardhat
- **Auth**: Privy (`@privy-io/react-auth`) — passkey-only login
- **Web3**: ethers.js v6
- **IPFS**: Pinata SDK v2

## Architecture
- Server relays votes to contract via hot wallet (privacy: all votes come from same address)
- Passkeys for auth via Privy (no MetaMask needed)
- Neural score = tier_score + voting_history (on-chain)
- Quorum delegation: delegate to 3-5 people, auto-vote follows majority
- Proposals pinned to IPFS via Pinata on creation

## Key Files
- `contracts/NQGVoting.sol` — Main voting contract
- `src/app/api/proposals/route.ts` — Proposal CRUD + voting + IPFS pinning
- `src/app/api/voters/route.ts` — Voter registration + admin approval
- `src/app/page.tsx` — Landing + active proposals
- `src/app/create/page.tsx` — Create proposal form
- `src/app/admin/page.tsx` — Admin panel (approve voters, start voting)
- `src/app/providers.tsx` — Privy + React Query providers
- `src/lib/contract.ts` — Contract ABI + ethers.js helpers
- `src/lib/pinata.ts` — IPFS pinning helper

## Monad Specifics
- Contract address: set in `.env.local` NEXT_PUBLIC_CONTRACT_ADDRESS
- Deployer/relayer: DEPLOYER_PRIVATE_KEY in `.env.local`
- Explorer: https://testnet.monadscan.com
- Faucet: https://faucet.monad.xyz
