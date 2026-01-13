import Link from "next/link";

import { auth } from "@/auth";
import ProfileMenu from "@/app/components/ProfileMenu";
import LogoMark from "@/app/components/LogoMark";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full bg-black">
      <div className="flex h-16 w-full items-center px-4 sm:px-6">
        <div className="flex w-full items-center justify-between gap-6">
          <Link href="/" aria-label="Home" className="inline-flex items-center">
            <LogoMark className="h-7 w-auto" />
          </Link>

          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <a href="#" className="hover:text-zinc-50">
              About syllab.ai
            </a>
            <a href="#" className="hover:text-zinc-50">
              Pricing
            </a>
            <a href="#" className="hover:text-zinc-50">
              FAQ
            </a>
            <a href="#" className="hover:text-zinc-50">
              Billing
            </a>
            <a href="#" className="hover:text-zinc-50">
              Support / Contact
            </a>
            </div>

            {session ? (
              <ProfileMenu user={session.user} />
            ) : (
              <Link
                href="/signin"
                className="inline-flex items-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_10px_30px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
