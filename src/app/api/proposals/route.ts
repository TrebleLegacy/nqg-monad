import { NextResponse } from "next/server";
import { getSession, getUser, hasVoted, markVoted } from "@/lib/store";
import { getContract, getReadContract } from "@/lib/contract";

// POST /api/proposals — create or vote
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId } = body;

    // Validate session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = getUser(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const contract = getContract();

    if (action === "create") {
      const { question, options, duration } = body;
      if (!question || !options || options.length < 2) {
        return NextResponse.json({ error: "Question and 2+ options required" }, { status: 400 });
      }

      const durationSecs = (duration || 3600); // default 1 hour
      const tx = await contract.createProposal(question, options, durationSecs);
      const receipt = await tx.wait();
      
      // Get proposal ID from event
      const event = receipt?.logs?.[0];
      let proposalId = 0;
      if (event) {
        try {
          const iface = contract.interface;
          const parsed = iface.parseLog({ topics: event.topics as string[], data: event.data });
          proposalId = Number(parsed?.args?.[0] || 0);
        } catch {
          // Fallback: read proposalCount
          const count = await contract.proposalCount();
          proposalId = Number(count) - 1;
        }
      }

      return NextResponse.json({ proposalId, txHash: receipt?.hash });
    }

    if (action === "vote") {
      const { proposalId, optionIndex } = body;
      
      if (proposalId === undefined || optionIndex === undefined) {
        return NextResponse.json({ error: "proposalId and optionIndex required" }, { status: 400 });
      }

      // Anti-double-vote (server-side)
      if (hasVoted(proposalId, user.id)) {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }

      const tx = await contract.vote(proposalId, user.evmAddress, optionIndex);
      const receipt = await tx.wait();
      
      markVoted(proposalId, user.id);

      return NextResponse.json({ txHash: receipt?.hash, optionIndex });
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
