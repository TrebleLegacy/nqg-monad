import { ethers } from "ethers";

const ABI = [
  "function registerVoter(address) external",
  "function approveVoter(address) external",
  "function setVotePower(address,uint256) external",
  "function createProposal(string,string[],uint256,uint256) external returns (uint256)",
  "function setProposalWindow(uint256,uint256,uint256) external",
  "function vote(uint256,address,uint256) external",
  "function getVotePower(address) view returns (uint256)",
  "function getResults(uint256) view returns (uint256[])",
  "function getProposalOptions(uint256) view returns (string[])",
  "function getProposalInfo(uint256) view returns (string,uint256,uint256,uint256,uint256,bool)",
  "function getVoterInfo(address) view returns (bool,bool,uint256)",
  "function proposalCount() view returns (uint256)",
  "function admin() view returns (address)",
  "event ProposalCreated(uint256 indexed proposalId, string question, uint256 startTime, uint256 endTime)",
  "event VoteCast(uint256 indexed proposalId, uint256 optionIndex, uint256 weight)",
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
