import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-black">
      <div className="flex h-16 w-full items-center px-4 sm:px-6">
        <div className="ml-auto flex items-center gap-8">
          <div className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <a href="#" className="hover:text-zinc-50">
              About syllab.ai
            </a>
            <a href="#" className="hover:text-zinc-50">
              Subscriptions
            </a>
            <a href="#" className="hover:text-zinc-50">
              For Schools
            </a>
          </div>

          <a
            href="#"
            className="inline-flex items-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_10px_30px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200"
          >
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}
