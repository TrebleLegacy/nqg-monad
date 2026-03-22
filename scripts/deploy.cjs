const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  console.log("Deploying with:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");

  // Read compiled artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/NQGVoting.sol/NQGVoting.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log("Deploying NQGVoting...");
  const contract = await factory.deploy(wallet.address); // relayer = deployer
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log("NQGVoting deployed to:", address);
  console.log("\nUpdate .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
