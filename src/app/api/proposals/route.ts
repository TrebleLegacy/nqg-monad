import { NextResponse } from "next/server";
import { getSession, getUser, hasVoted, markVoted } from "@/lib/store";
import { getContract, getReadContract } from "@/lib/contract";
import { assertAdminSecret } from "@/lib/adminAuth";

// POST /api/proposals — create (admin) or vote
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId } = body;

    const contract = getContract();

    if (action === "create") {
      assertAdminSecret(body.adminSecret);

      const { question, options, startTime, endTime } = body;
      if (!question || !options || options.length < 2) {
        return NextResponse.json({ error: "Question and 2+ options required" }, { status: 400 });
      }
      if (startTime === undefined || endTime === undefined) {
        return NextResponse.json({ error: "startTime and endTime (unix seconds) required" }, { status: 400 });
      }

      const start = BigInt(startTime);
      const end = BigInt(endTime);
      const tx = await contract.createProposal(question.trim(), options, start, end);
      const receipt = await tx.wait();

      let proposalId = 0;
      if (receipt?.logs?.length) {
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed?.name === "ProposalCreated") {
              proposalId = Number(parsed.args[0]);
              break;
            }
          } catch {
            /* next log */
          }
        }
      }
      if (proposalId === 0) {
        const count = await contract.proposalCount();
        proposalId = Number(count) - 1;
      }

      return NextResponse.json({ proposalId, txHash: receipt?.hash });
    }

    // vote requires session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = getUser(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "vote") {
      const { proposalId, optionIndex } = body;

      if (proposalId === undefined || optionIndex === undefined) {
        return NextResponse.json({ error: "proposalId and optionIndex required" }, { status: 400 });
      }

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
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
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
        const [question, startTime, endTime, , totalWeight, votingOpen] =
          await contract.getProposalInfo(i);
        const options = await contract.getProposalOptions(i);
        const results = await contract.getResults(i);

        proposals.push({
          id: i,
          question,
          startTime: Number(startTime),
          endTime: Number(endTime),
          options,
          results: results.map((r: bigint) => Number(r)),
          totalWeight: Number(totalWeight),
          active: votingOpen,
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
