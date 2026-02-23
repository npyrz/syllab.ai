import { auth, signIn } from "@/auth";
import TimezoneInput from "@/app/components/TimezoneInput";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

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

  const googleConfigured =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-text)]">
      <main className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-xl items-center px-6 py-20">
        <section className="rounded-3xl bg-[color:var(--app-surface)] p-6 ring-1 ring-[color:var(--app-border)] backdrop-blur-xl">
          <h1 className="text-balance text-3xl font-normal tracking-tight text-[color:var(--app-text)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--app-subtle)]">
            Use your account to log in to syllab.ai.
          </p>

          {sp.error ? (
            <div className="mt-5 rounded-2xl bg-[color:var(--app-panel)] p-4 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)]">
              We couldn’t sign you in. Please try again.
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

            <div className="my-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-[color:var(--app-border)]" />
              <div className="text-xs text-[color:var(--app-subtle)]">or</div>
              <div className="h-px flex-1 bg-[color:var(--app-border)]" />
            </div>

            <form
              action={async (formData) => {
                "use server";
                const email = String(formData.get("email") ?? "")
                  .trim()
                  .toLowerCase();
                const password = String(formData.get("password") ?? "");
                const timezone = String(formData.get("timezone") ?? "").trim();
                try {
                  await signIn("credentials", {
                    email,
                    password,
                    redirectTo: callbackUrl,
                    timezone,
                  });
                } catch (error) {
                  if (error instanceof AuthError && error.type === "CredentialsSignin") {
                    redirect(
                      `/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`
                    );
                  }
                  throw error;
                }
              }}
              className="flex flex-col gap-3"
            >
              <TimezoneInput />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--app-subtle)]">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl bg-[color:var(--app-panel)] px-4 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none focus:ring-[color:var(--app-subtle)]"
                  placeholder="you@example.com"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--app-subtle)]">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl bg-[color:var(--app-panel)] px-4 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none focus:ring-[color:var(--app-subtle)]"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
              >
                Sign in
              </button>
            </form>

            <div className="pt-1 text-center text-sm text-[color:var(--app-subtle)]">
              Don’t have an account?{" "}
              <Link
                href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="text-[color:var(--app-text)] hover:underline"
              >
                Sign up
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
