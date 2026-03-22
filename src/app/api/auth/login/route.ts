import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { getAllUsers, getUser, setChallenge, createSession } from "@/lib/store";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { step, assertion, challenge } = body;

    if (step === "start") {
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "preferred",
      });

      setChallenge(options.challenge, "login-pending");

      return NextResponse.json({ options });
    }

    if (step === "complete") {
      // Find user by credential ID
      const credentialId = assertion.id;
      const allUsers = getAllUsers();
      
      let matchedUser = null;
      let matchedAuth = null;

      for (const user of allUsers) {
        for (const auth of user.authenticators) {
          const authIdB64 = Buffer.from(auth.credentialID).toString("base64url");
          if (authIdB64 === credentialId) {
            matchedUser = user;
            matchedAuth = auth;
            break;
          }
        }
        if (matchedUser) break;
      }

      if (!matchedUser || !matchedAuth) {
        return NextResponse.json({ error: "Unknown credential" }, { status: 401 });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: assertion,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: matchedAuth.credentialID,
            publicKey: matchedAuth.credentialPublicKey,
            counter: matchedAuth.counter,
          },
        });
      } catch {
        return NextResponse.json({ error: "Auth verification failed" }, { status: 401 });
      }

      if (!verification.verified) {
        return NextResponse.json({ error: "Not verified" }, { status: 401 });
      }

      // Update counter
      matchedAuth.counter = verification.authenticationInfo.newCounter;

      const sessionId = createSession(matchedUser.id);

      return NextResponse.json({
        verified: true,
        sessionId,
        username: matchedUser.username,
        evmAddress: matchedUser.evmAddress,
        userId: matchedUser.id,
      });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
