import { ERC } from "@rwa-verify/core";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import { result, type Check } from "./context.js";

// erc165.detect — what the token declares via ERC-165. `unsupported` when the token is not ERC-165.
export const erc165Detect: Check = async (ctx) => {
  const { detection } = ctx;
  return result(ctx, "erc165.detect", ERC.URWA, detection.erc165 ? "pass" : "unsupported", {
    erc165: detection.erc165,
    supports: detection.supports,
    interfaceIds: INTERFACE_IDS,
    answers: detection.answers,
  });
};
