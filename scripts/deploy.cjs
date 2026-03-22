const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No deployer account: set DEPLOYER_PRIVATE_KEY in .env.local or .env (project root). Copy .env.example if needed."
    );
  }
  const deployer = signers[0];
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const NQGVoting = await hre.ethers.getContractFactory("NQGVoting");
  // Relayer = deployer (same hot wallet for hackathon)
  const contract = await NQGVoting.deploy(deployer.address);
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
