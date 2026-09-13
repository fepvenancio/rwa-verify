import { parseAbi } from "viem";

// ERC-4626 read subset. ERC-4626 defines no ERC-165 interface ID; support is probed by calling.
export const erc4626Abi = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
