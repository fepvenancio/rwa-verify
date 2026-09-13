# @rwa-verify/sdk

Read-side verification for tokenised real-world assets. Produces a `VerificationReport` for any token: ERC-3643 / ERC-7943 / ERC-4626 baseline facts always, plus ERC-8325 mutual binding, ERC-8330 NAV freshness, ERC-8320 active claims, ERC-8326 active bundle and ERC-8328 current event when the token declares those standards. Every check carries a `reproduce` CLI command.

```ts
import { createPublicClient, http } from "viem";
import { verify } from "@rwa-verify/sdk";

const client = createPublicClient({ transport: http(rpcUrl) });
const report = await verify({ client, chainId: 1, token: "0x…", registryHints: {} });
```

CLI:

```bash
npx rwa-verify <token> --chain <id> --rpc <url> [--token-id <n>] [hints]
npx rwa-verify check <id> --chain <id> --rpc <url> --token <addr>
```

Check ids and status semantics: [CHECKS.md](https://github.com/fepvenancio/rwa-verify/blob/main/packages/sdk/CHECKS.md). Missing 83xx support reports `unsupported`, never `fail`.

Repository: https://github.com/fepvenancio/rwa-verify
