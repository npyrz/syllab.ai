import Link from "next/link";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { redirect } from "next/navigation";

type SignUpPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const sp = (await searchParams) ?? {};
  const callbackUrl = sp.callbackUrl ?? "/";

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-black">
      <main className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-xl items-center px-6 py-20">
        <section className="rounded-3xl bg-white/6 p-6 ring-1 ring-white/10 backdrop-blur-xl">
          <h1 className="text-balance text-3xl font-normal tracking-tight text-zinc-50">
            Sign up
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Create an account for syllab.ai.
          </p>

          {sp.error ? (
            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 ring-1 ring-white/10">
              {sp.error === "EmailInUse"
                ? "That email is already in use. Try signing in instead."
                : sp.error === "UsernameInUse"
                  ? "That username is already taken. Please pick another."
                  : "We couldn’t create your account. Please try again."}
            </div>
          ) : null}

          <form
            action={async (formData) => {
              "use server";
              const username = String(formData.get("username") ?? "")
                .trim()
                .toLowerCase();
              const name = String(formData.get("name") ?? "").trim();
              const email = String(formData.get("email") ?? "")
                .trim()
                .toLowerCase();
              const password = String(formData.get("password") ?? "");

              if (!username || !email || !password) {
                redirect(`/signup?error=InvalidInput&callbackUrl=${encodeURIComponent(callbackUrl)}`);
              }

              const existingUsername = await prisma.user.findUnique({
                where: { username },
              });
              if (existingUsername) {
                redirect(`/signup?error=UsernameInUse&callbackUrl=${encodeURIComponent(callbackUrl)}`);
              }

              const existing = await prisma.user.findUnique({ where: { email } });
              if (existing) {
                redirect(`/signup?error=EmailInUse&callbackUrl=${encodeURIComponent(callbackUrl)}`);
              }

              const passwordHash = await hashPassword(password);
              await prisma.user.create({
                data: {
                  username,
                  email,
                  name: name || null,
                  passwordHash,
                  provider: "credentials",
                  lastLoginAt: new Date(),
                  lastSeenAt: new Date(),
                },
              });

              await signIn("credentials", {
                email,
                password,
                redirectTo: callbackUrl,
              });
            }}
            className="mt-6 flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Username</span>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                className="h-11 rounded-xl bg-black/30 px-4 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-white/20"
                placeholder="noah"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Name (optional)</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                className="h-11 rounded-xl bg-black/30 px-4 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-white/20"
                placeholder="Jane Doe"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 rounded-xl bg-black/30 px-4 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-white/20"
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl bg-black/30 px-4 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-white/20"
                placeholder="At least 8 characters"
              />
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
            >
              Create account
            </button>

            <div className="pt-1 text-center text-sm text-zinc-400">
              Already have an account?{" "}
              <Link
                href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="text-zinc-100 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
