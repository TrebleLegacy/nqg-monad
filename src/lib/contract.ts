import { ethers } from "ethers";

// ABI for NQGVoting v2 (admin controls)
const ABI = [
  // Admin: approve voters
  "function approveVoter(address _voter, uint8 _tier) external",
  "function batchApproveVoters(address[] memory _voters, uint8[] memory _tiers) external",
  "function setVoterTier(address _voter, uint8 _tier) external",
  // Registration
  "function registerVoter(address _voter) external",
  // Proposals
  "function createProposal(string memory _question, string[] memory _options, uint256 _duration) external returns (uint256)",
  "function startVoting(uint256 _proposalId) external",
  // Voting
  "function vote(uint256 _proposalId, address _voter, uint256 _optionIndex) external",
  "function resolveQuorumVote(uint256 _proposalId, address _voter) external",
  "function setQuorumDelegates(address _voter, address[] memory _delegates) external",
  // Views
  "function getVotePower(address _voter) view returns (uint256)",
  "function getResults(uint256 _proposalId) view returns (uint256[])",
  "function getProposalOptions(uint256 _proposalId) view returns (string[])",
  "function getProposalInfo(uint256 _proposalId) view returns (string question, uint256 endTime, uint256 optionCount, uint256 totalWeight, bool active, bool started)",
  "function getVoterInfo(address _voter) view returns (bool registered, bool approved, uint256 tier, uint256 votesParticipated, uint256 votePower, uint256 quorumSize)",
  "function getQuorumDelegates(address _voter) view returns (address[])",
  "function getApprovedVoterCount() view returns (uint256)",
  "function getApprovedVoters() view returns (address[])",
  "function proposalCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function voteRecords(uint256, address) view returns (bool hasVoted, uint256 optionIndex, uint256 weight)",
];

const RPC = process.env.NEXT_PUBLIC_MONAD_RPC || "https://testnet-rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(RPC);

export function getContract() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const wallet = new ethers.Wallet(pk, provider);
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error("Contract address not set");
  return new ethers.Contract(address, ABI, wallet);
}

export function getReadContract() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error("Contract address not set");
  return new ethers.Contract(address, ABI, provider);
}

export { provider };
