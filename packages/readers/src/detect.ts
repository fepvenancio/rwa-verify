import type { PublicClient } from "viem";
import type { Hex } from "@rwa-verify/core";
import { erc165Abi } from "./abi/erc165.js";
import { INTERFACE_IDS, type InterfaceName } from "./abi/interfaceIds.js";
import { read } from "./call.js";

export interface Detection {
  address: Hex;
  blockNumber: bigint;
  erc165: boolean; // true iff supportsInterface(0x01ffc9a7) is true and supportsInterface(0xffffffff) is false
  supports: Record<InterfaceName, boolean>;
  // Raw answers per interface ID, for evidence. "revert" when the target did not answer as ERC-165.
  answers: Record<Hex, boolean | "revert">;
}

// supportsInterface tolerant of non-contracts, reverts and garbage: anything but a clean `true` is false.
export async function supportsInterface(client: PublicClient, address: Hex, id: Hex, blockNumber: bigint): Promise<boolean> {
  const r = await read(client, { address, abi: erc165Abi, functionName: "supportsInterface", args: [id], blockNumber });
  return r.ok && r.value === true;
}

export async function detect(client: PublicClient, address: Hex, blockNumber: bigint): Promise<Detection> {
  const answers: Record<Hex, boolean | "revert"> = {};
  const probe = async (id: Hex) => {
    const r = await read(client, { address, abi: erc165Abi, functionName: "supportsInterface", args: [id], blockNumber });
    answers[id] = r.ok ? r.value : "revert";
    return r.ok && r.value === true;
  };
  // ERC-165 detection procedure: must answer true for its own ID and false for 0xffffffff.
  const erc165 = (await probe(INTERFACE_IDS.IERC165)) && !(await probe("0xffffffff"));
  const supports = {} as Record<InterfaceName, boolean>;
  for (const name of Object.keys(INTERFACE_IDS) as InterfaceName[]) {
    supports[name] = erc165 && (name === "IERC165" || (await probe(INTERFACE_IDS[name])));
  }
  return { address, blockNumber, erc165, supports, answers };
}
