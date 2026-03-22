import { NextResponse } from "next/server";
import { getContract, getReadContract } from "@/lib/contract";

// POST /api/voters — register or get voter info
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, address } = body;

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const contract = getContract();

    if (action === "register") {
      try {
        // Check if already registered
        const readContract = getReadContract();
        const [registered] = await readContract.getVoterInfo(address);
        if (registered) {
          return NextResponse.json({ already: true });
        }

        const tx = await contract.registerVoter(address);
        await tx.wait();
        return NextResponse.json({ registered: true, txHash: tx.hash });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Registration failed";
        // Ignore "Already registered" errors
        if (msg.includes("Already registered")) {
          return NextResponse.json({ already: true });
        }
        console.error("Register error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    if (action === "info") {
      const readContract = getReadContract();
      const [registered, tier, votesParticipated, votePower, quorumSize] = 
        await readContract.getVoterInfo(address);
      return NextResponse.json({
        registered,
        tier: Number(tier),
        votesParticipated: Number(votesParticipated),
        votePower: Number(votePower),
        quorumSize: Number(quorumSize),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Voters error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
