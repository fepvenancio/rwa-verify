import { parseAbi } from "viem";

// ERC-7943 uRWA — three base-token variants, transcribed from specs/erc-7943.md.
// The spec states the interface IDs literally: 0x3edbb4c4 / 0xbf1ef5fe / 0x41c4fbad.

export const erc7943FungibleAbi = parseAbi([
  "event ForcedTransfer(address indexed from, address indexed to, uint256 amount)",
  "event Frozen(address indexed account, uint256 amount)",
  "function forcedTransfer(address from, address to, uint256 amount) returns (bool result)",
  "function setFrozenTokens(address account, uint256 amount) returns (bool result)",
  "function canSend(address account) view returns (bool allowed)",
  "function canReceive(address account) view returns (bool allowed)",
  "function getFrozenTokens(address account) view returns (uint256 amount)",
  "function canTransfer(address from, address to, uint256 amount) view returns (bool allowed)",
]);

export const erc7943NonFungibleAbi = parseAbi([
  "event ForcedTransfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Frozen(address indexed account, uint256 indexed tokenId, bool indexed frozenStatus)",
  "function forcedTransfer(address from, address to, uint256 tokenId) returns (bool result)",
  "function setFrozenTokens(address account, uint256 tokenId, bool frozenStatus) returns (bool result)",
  "function canSend(address account) view returns (bool allowed)",
  "function canReceive(address account) view returns (bool allowed)",
  "function getFrozenTokens(address account, uint256 tokenId) view returns (bool frozenStatus)",
  "function canTransfer(address from, address to, uint256 tokenId) view returns (bool allowed)",
]);

export const erc7943MultiTokenAbi = parseAbi([
  "event ForcedTransfer(address indexed from, address indexed to, uint256 indexed tokenId, uint256 amount)",
  "event Frozen(address indexed account, uint256 indexed tokenId, uint256 amount)",
  "function forcedTransfer(address from, address to, uint256 tokenId, uint256 amount) returns (bool result)",
  "function setFrozenTokens(address account, uint256 tokenId, uint256 amount) returns (bool result)",
  "function canSend(address account) view returns (bool allowed)",
  "function canReceive(address account) view returns (bool allowed)",
  "function getFrozenTokens(address account, uint256 tokenId) view returns (uint256 amount)",
  "function canTransfer(address from, address to, uint256 tokenId, uint256 amount) view returns (bool allowed)",
]);
