import { NextResponse } from "next/server";
import { getContract, getReadContract } from "@/lib/contract";
import { pinProposalToIPFS } from "@/lib/pinata";

// In-memory IPFS hash store (proposalId → CID)
// Survives HMR but not full restarts — acceptable for hackathon
const ipfsHashes = new Map<number, { cid: string; url: string }>();
const hiddenProposals = new Set<number>();

// POST /api/proposals — create, start voting, or vote
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const contract = getContract();

    if (action === "create") {
      const { question, options, duration } = body;
      if (!question || !options || options.length < 2) {
        return NextResponse.json({ error: "Question and 2+ options required" }, { status: 400 });
      }

      const durationSecs = duration || 3600;
      const tx = await contract.createProposal(question, options, durationSecs);
      await tx.wait();

      let proposalId = 0;
      try {
        const count = await contract.proposalCount();
        proposalId = Number(count) - 1;
      } catch { /* fallback */ }

      // Pin proposal metadata to IPFS (fire-and-forget, never blocks)
      const pinResult = await pinProposalToIPFS({
        proposalId,
        question,
        options,
        duration: durationSecs,
        txHash: tx.hash,
        creator: body.creatorAddress || "anonymous",
        createdAt: new Date().toISOString(),
      });

      if (pinResult.ipfsHash) {
        ipfsHashes.set(proposalId, { cid: pinResult.ipfsHash, url: pinResult.gatewayUrl! });
      }

      // Auto-start voting so proposals are immediately active
      try {
        const startTx = await contract.startVoting(proposalId);
        await startTx.wait();
      } catch (e) {
        console.warn("Auto-start voting failed (may already be started):", e);
      }

      return NextResponse.json({
        proposalId,
        txHash: tx.hash,
        status: "active",
        ipfsHash: pinResult.ipfsHash,
        ipfsUrl: pinResult.gatewayUrl,
      });
    }

    // Admin: start voting on a proposal
    if (action === "startVoting") {
      const { proposalId } = body;
      if (proposalId === undefined) {
        return NextResponse.json({ error: "proposalId required" }, { status: 400 });
      }
      const tx = await contract.startVoting(proposalId);
      await tx.wait();
      return NextResponse.json({ started: true, txHash: tx.hash });
    }

    if (action === "vote") {
      const { proposalId, optionIndex, voterAddress, userId } = body;
      if (proposalId === undefined || optionIndex === undefined) {
        return NextResponse.json({ error: "proposalId and optionIndex required" }, { status: 400 });
      }

      // Use wallet address if available, otherwise derive from userId
      const { ethers } = await import("ethers");
      const address = voterAddress || (userId ? ethers.computeAddress(ethers.id(userId)) : null);
      if (!address) {
        return NextResponse.json({ error: "Login required" }, { status: 401 });
      }

      const readContract = getReadContract();

      // Auto-register + auto-approve if needed (seamless flow)
      const [registered, approved] = await readContract.getVoterInfo(address);
      if (!registered) {
        const regTx = await contract.registerVoter(address);
        await regTx.wait();
      }
      if (!approved) {
        const appTx = await contract.approveVoter(address, 0); // Newcomer
        await appTx.wait();
      }

      // Check not already voted
      const voteRecord = await readContract.voteRecords(proposalId, address);
      if (voteRecord.hasVoted) {
        return NextResponse.json({ error: "Already voted on this proposal" }, { status: 409 });
      }

      const tx = await contract.vote(proposalId, address, optionIndex);
      const receipt = await tx.wait();

      const votePower = await readContract.getVotePower(address);

      return NextResponse.json({
        txHash: receipt?.hash,
        optionIndex,
        weight: Number(votePower),
      });
    }

    // Soft-delete: hide proposal from listing
    if (action === "delete") {
      const { proposalId } = body;
      if (proposalId === undefined) {
        return NextResponse.json({ error: "proposalId required" }, { status: 400 });
      }
      hiddenProposals.add(Number(proposalId));
      return NextResponse.json({ deleted: true, proposalId: Number(proposalId) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Proposal action error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/proposals — list all proposals
export async function GET() {
  try {
    const contract = getReadContract();
    const count = await contract.proposalCount();
    const proposals = [];

    for (let i = 0; i < Number(count); i++) {
      if (hiddenProposals.has(i)) continue;
      try {
        const [question, endTime, optionCount, totalWeight, active, started] =
          await contract.getProposalInfo(i);
        const options = await contract.getProposalOptions(i);
        const results = await contract.getResults(i);

        const ipfs = ipfsHashes.get(i);
        proposals.push({
          id: i,
          question,
          endTime: Number(endTime),
          options,
          results: results.map((r: bigint) => Number(r)),
          totalWeight: Number(totalWeight),
          active,
          started,
          ipfsHash: ipfs?.cid || null,
          ipfsUrl: ipfs?.url || null,
        });
      } catch {
        continue;
      }
    }

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error("Get proposals error:", error);
    return NextResponse.json({ proposals: [] });
  }
}
