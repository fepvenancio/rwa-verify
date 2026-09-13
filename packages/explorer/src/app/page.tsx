import Link from "next/link";
import { HINT_FLAGS } from "@rwa-verify/sdk";
import { Examples } from "@/components/Examples";
import { VerifyForm } from "@/components/VerifyForm";

export default function Home() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Verify a token</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Read-side verification for tokenised real-world assets: give it a token and it reports what the token declares (ERC-3643 / 7943 / 4626, then
        ERC-8320 / 8325 / 8326 / 8328 / 8330 where present) and whether those declarations hold, each with the CLI command that reproduces it.{" "}
        <Link href="/about" className="underline">
          See About
        </Link>{" "}
        for how it works.
      </p>
      <VerifyForm hints={Object.entries(HINT_FLAGS)} />
      <h2 className="mt-8 text-base font-semibold">Or try an example</h2>
      <div className="mt-2">
        <Examples />
      </div>
    </div>
  );
}
