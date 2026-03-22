import { PinataSDK } from "pinata";

/**
 * IPFS Pinning via Pinata — Proposal Data Flow
 * =============================================
 *
 *  route.ts POST (create)
 *       │
 *       ▼
 *  pinProposalToIPFS(data)
 *       │
 *       ├─ success → { ipfsHash: "bafy...", gatewayUrl: "https://..." }
 *       │
 *       └─ failure → { ipfsHash: null, gatewayUrl: null }
 *                     (logged, never blocks proposal creation)
 */

let pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinata) {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) throw new Error("PINATA_JWT not set");
    pinata = new PinataSDK({ pinataJwt: jwt });
  }
  return pinata;
}

export interface PinResult {
  ipfsHash: string | null;
  gatewayUrl: string | null;
}

export interface ProposalPinData {
  proposalId: number;
  question: string;
  options: string[];
  duration: number;
  txHash: string;
  creator: string;
  createdAt: string;
}

/**
 * Pin proposal metadata to IPFS via Pinata.
 * Graceful: returns null on failure, never throws.
 */
export async function pinProposalToIPFS(
  data: ProposalPinData,
): Promise<PinResult> {
  try {
    const sdk = getPinata();
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "";

    const result = await sdk.upload.public
      .json(data)
      .name(`nqg-proposal-${data.proposalId}`);

    const cid = result.cid;
    const gatewayUrl = gateway
      ? `https://${gateway}/ipfs/${cid}`
      : `https://gateway.pinata.cloud/ipfs/${cid}`;

    return { ipfsHash: cid, gatewayUrl };
  } catch (error) {
    console.error("[Pinata] Failed to pin proposal:", error);
    return { ipfsHash: null, gatewayUrl: null };
  }
}
