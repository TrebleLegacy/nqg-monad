import { NextResponse } from "next/server";
import { getContract, getReadContract } from "@/lib/contract";

// POST /api/voters — register, approve, or get voter info
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, address } = body;

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const contract = getContract();
    const readContract = getReadContract();

    // Self-register (pending admin approval)
    if (action === "register") {
      try {
        const [registered] = await readContract.getVoterInfo(address);
        if (registered) return NextResponse.json({ already: true });

        const tx = await contract.registerVoter(address);
        await tx.wait();
        return NextResponse.json({ registered: true, txHash: tx.hash });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Registration failed";
        if (msg.includes("Already") || msg.includes("registered")) {
          return NextResponse.json({ already: true });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Admin: approve voter with tier
    if (action === "approve") {
      const { tier } = body; // 0=Newcomer, 1=Contributor, 2=Expert, 3=Admin
      try {
        const tx = await contract.approveVoter(address, tier ?? 0);
        await tx.wait();
        return NextResponse.json({ approved: true, txHash: tx.hash });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Approval failed";
        if (msg.includes("Already approved")) {
          return NextResponse.json({ already: true });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Admin: batch approve
    if (action === "batchApprove") {
      const { voters: voterList, tiers } = body;
      if (!voterList || !tiers || voterList.length !== tiers.length) {
        return NextResponse.json({ error: "voters and tiers arrays required" }, { status: 400 });
      }
      const tx = await contract.batchApproveVoters(voterList, tiers);
      await tx.wait();
      return NextResponse.json({ approved: true, count: voterList.length, txHash: tx.hash });
    }

    // Admin: update tier
    if (action === "setTier") {
      const { tier } = body;
      const tx = await contract.setVoterTier(address, tier);
      await tx.wait();
      return NextResponse.json({ updated: true, txHash: tx.hash });
    }

    // Get voter info
    if (action === "info") {
      const [registered, approved, tier, votesParticipated, votePower, quorumSize] =
        await readContract.getVoterInfo(address);
      return NextResponse.json({
        registered,
        approved,
        tier: Number(tier),
        votesParticipated: Number(votesParticipated),
        votePower: Number(votePower),
        quorumSize: Number(quorumSize),
      });
    }

    // Get all approved voters
    if (action === "listApproved") {
      const voters = await readContract.getApprovedVoters();
      const count = await readContract.getApprovedVoterCount();
      return NextResponse.json({ voters, count: Number(count) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Voters error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
