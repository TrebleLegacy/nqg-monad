import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { createUser, getUserByUsername, setChallenge, createSession } from "@/lib/store";
import { getContract } from "@/lib/contract";
import { ethers } from "ethers";

const rpName = process.env.WEBAUTHN_RP_NAME || "NQG Monad";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

// POST /api/auth/register — start + complete registration in one call
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { step, username, attestation } = body;

    if (step === "start") {
      // Step 1: Generate registration options
      if (!username || username.length < 2) {
        return NextResponse.json({ error: "Username required (min 2 chars)" }, { status: 400 });
      }

      const existing = getUserByUsername(username);
      if (existing) {
        return NextResponse.json({ error: "Username taken" }, { status: 409 });
      }

      const userId = crypto.randomUUID();
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId),
        userName: username,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      // Store challenge temporarily
      setChallenge(options.challenge, `pending:${userId}:${username}`);

      return NextResponse.json({ options, userId });
    }

    if (step === "complete") {
      // Step 2: Verify registration
      const { challenge, userId: pendingUserId, username: pendingUsername } = body;

      const stored = `pending:${pendingUserId}:${pendingUsername}`;

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: attestation,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });
      } catch {
        return NextResponse.json({ error: "Verification failed" }, { status: 400 });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ error: "Registration not verified" }, { status: 400 });
      }

      const { credential } = verification.registrationInfo;

      // Generate deterministic EVM address from credential ID
      const credIdHex = Buffer.from(credential.id).toString("hex");
      const evmAddress = ethers.keccak256(ethers.toUtf8Bytes(credIdHex)).slice(0, 42);

      // Save user
      createUser({
        id: pendingUserId,
        username: pendingUsername,
        evmAddress,
        authenticators: [{
          credentialID: credential.id,
          credentialPublicKey: credential.publicKey,
          counter: credential.counter,
          transports: attestation.response?.transports,
        }],
        registeredAt: Date.now(),
      });

      // Register voter on-chain (async, don't block response)
      try {
        const contract = getContract();
        const tx = await contract.registerVoter(evmAddress);
        await tx.wait();
      } catch (e) {
        console.error("On-chain registration failed:", e);
        // Continue anyway — can retry later
      }

      // Create session
      const sessionId = createSession(pendingUserId);

      return NextResponse.json({
        verified: true,
        sessionId,
        username: pendingUsername,
        evmAddress,
      });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
