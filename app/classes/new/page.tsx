import { auth } from "@/auth";
import { redirect } from "next/navigation";

import CreateClassForm from "@/app/components/CreateClassForm";

export default async function NewClassPage() {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=%2Fclasses%2Fnew");

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-black">
      <main className="relative mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-balance text-3xl font-normal tracking-tight text-zinc-50">
          Create a class
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Add class details and upload documents to get started.
        </p>

        <div className="mt-8">
          <CreateClassForm />
        </div>
      </main>
    </div>
  );
}
