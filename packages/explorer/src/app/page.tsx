import { HINT_FLAGS } from "@rwa-verify/readers";
import { VerifyForm } from "@/components/VerifyForm";

export default function Home() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Verify a token</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Reads the token and reports ERC-3643 / 7943 / 4626 facts, then ERC-8320 / 8325 / 8326 / 8328 / 8330 where the token declares them.
        Every check comes with the CLI command that reproduces it.
      </p>
      <VerifyForm hints={Object.entries(HINT_FLAGS)} />
    </div>
  );
}
