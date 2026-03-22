import { NextResponse } from "next/server";
import { getContract } from "@/lib/contract";
import { assertAdminSecret } from "@/lib/adminAuth";

/**
 * POST /api/admin — approve voters, set weights, or reschedule polls (requires ADMIN_SECRET).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, adminSecret } = body;

    assertAdminSecret(adminSecret);

    const contract = getContract();

    if (action === "approveVoter") {
      const addr = body.address as string;
      if (!addr) {
        return NextResponse.json({ error: "address required" }, { status: 400 });
      }
      const tx = await contract.approveVoter(addr);
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt?.hash });
    }

    if (action === "setVotePower") {
      const addr = body.address as string;
      const power = body.votePower;
      if (!addr || power === undefined) {
        return NextResponse.json({ error: "address and votePower required" }, { status: 400 });
      }
      const tx = await contract.setVotePower(addr, BigInt(power));
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt?.hash });
    }

    if (action === "setProposalWindow") {
      const proposalId = body.proposalId;
      const startTime = body.startTime;
      const endTime = body.endTime;
      if (proposalId === undefined || startTime === undefined || endTime === undefined) {
        return NextResponse.json(
          { error: "proposalId, startTime, endTime required" },
          { status: 400 }
        );
      }
      const tx = await contract.setProposalWindow(
        BigInt(proposalId),
        BigInt(startTime),
        BigInt(endTime)
      );
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt?.hash });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Admin action error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
