import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = (await searchParams) ?? {};
  const session = await auth();
  const callbackUrl = sp.callbackUrl ?? "/";
  if (session) redirect(callbackUrl);

  const githubConfigured =
    !!process.env.AUTH_GITHUB_ID && !!process.env.AUTH_GITHUB_SECRET;
  const googleConfigured =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-black">
      <main className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-xl items-center px-6 py-20">
        <section className="rounded-3xl bg-white/6 p-6 ring-1 ring-white/10 backdrop-blur-xl">
          <h1 className="text-balance text-3xl font-normal tracking-tight text-zinc-50">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Use your account to log in to syllab.ai.
          </p>

          {sp.error ? (
            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 ring-1 ring-white/10">
              We couldn’t sign you in. Please try again.
            </div>
          ) : null}

          {!githubConfigured && !googleConfigured ? (
            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 ring-1 ring-white/10">
              No login providers are configured yet. Add GitHub and/or Google credentials to <span className="text-zinc-50">.env.local</span>.
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                disabled={!googleConfigured}
                className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue with Google
              </button>
            </form>

            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                disabled={!githubConfigured}
                className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue with GitHub
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
