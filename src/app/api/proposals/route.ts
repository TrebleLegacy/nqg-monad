import { NextResponse } from "next/server";
import { getContract, getReadContract } from "@/lib/contract";

// POST /api/proposals — create or vote
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const contract = getContract();

    if (action === "create") {
      const { question, options, duration, creatorAddress } = body;
      if (!question || !options || options.length < 2) {
        return NextResponse.json({ error: "Question and 2+ options required" }, { status: 400 });
      }

      const durationSecs = duration || 3600;
      const tx = await contract.createProposal(question, options, durationSecs);
      const receipt = await tx.wait();

      let proposalId = 0;
      try {
        const count = await contract.proposalCount();
        proposalId = Number(count) - 1;
      } catch { /* fallback */ }

      return NextResponse.json({ proposalId, txHash: receipt?.hash });
    }

    if (action === "vote") {
      const { proposalId, optionIndex, voterAddress } = body;

      if (proposalId === undefined || optionIndex === undefined || !voterAddress) {
        return NextResponse.json(
          { error: "proposalId, optionIndex, and voterAddress required" },
          { status: 400 }
        );
      }

      // Check if already voted on-chain
      const readContract = getReadContract();
      const voteRecord = await readContract.voteRecords(proposalId, voterAddress);
      if (voteRecord.hasVoted) {
        return NextResponse.json({ error: "Already voted on this proposal" }, { status: 409 });
      }

      const tx = await contract.vote(proposalId, voterAddress, optionIndex);
      const receipt = await tx.wait();

      // Get updated vote power
      const votePower = await readContract.getVotePower(voterAddress);

      return NextResponse.json({
        txHash: receipt?.hash,
        optionIndex,
        weight: Number(votePower),
      });
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
      try {
        const [question, endTime, optionCount, totalWeight, active] =
          await contract.getProposalInfo(i);
        const options = await contract.getProposalOptions(i);
        const results = await contract.getResults(i);

        proposals.push({
          id: i,
          question,
          endTime: Number(endTime),
          options,
          results: results.map((r: bigint) => Number(r)),
          totalWeight: Number(totalWeight),
          active,
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
