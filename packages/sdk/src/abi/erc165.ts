import { parseAbi } from "viem";

// ERC-165
export const erc165Abi = parseAbi([
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);
