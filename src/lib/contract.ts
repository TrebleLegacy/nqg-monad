import { ethers } from "ethers";

const ABI = [
  "function registerVoter(address) external",
  "function setVoterTier(address, uint8) external",
  "function createProposal(string, string[], uint256) external returns (uint256)",
  "function vote(uint256, address, uint256) external",
  "function setQuorumDelegates(address, address[]) external",
  "function resolveQuorumVote(uint256, address) external",
  "function getVotePower(address) view returns (uint256)",
  "function getResults(uint256) view returns (uint256[])",
  "function getProposalOptions(uint256) view returns (string[])",
  "function getProposalInfo(uint256) view returns (string, uint256, uint256, uint256, bool)",
  "function getVoterInfo(address) view returns (bool, uint256, uint256, uint256, uint256)",
  "function getQuorumDelegates(address) view returns (address[])",
  "function proposalCount() view returns (uint256)",
  "event ProposalCreated(uint256 indexed proposalId, string question, uint256 endTime)",
  "event VoteCast(uint256 indexed proposalId, uint256 optionIndex, uint256 weight)",
  "event QuorumVoteResolved(uint256 indexed proposalId, address indexed voter, uint256 optionIndex, uint256 weight)",
];

const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_MONAD_RPC || "https://testnet-rpc.monad.xyz"
);

const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

export function getContract() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error("Contract address not set");
  return new ethers.Contract(address, ABI, wallet);
}

export function getReadContract() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error("Contract address not set");
  return new ethers.Contract(address, ABI, provider);
}

export { provider, wallet, ABI };
