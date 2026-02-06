import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

type DocumentRow = {
  id: string;
  filename: string;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const classId = resolvedParams?.id;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=%2Fclasses%2F${classId ?? ""}`);

  if (!classId) notFound();

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classRecord) notFound();

  const isOwner = classRecord.userId === session.user.id;
  if (!isOwner) {
    return (
      <div className="relative min-h-[calc(100vh-64px)] bg-black">
        <main className="mx-auto w-full max-w-3xl px-6 py-12">
          <div className="rounded-2xl bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-white/10">
            <div className="text-zinc-100">Access mismatch</div>
            <div className="mt-3 text-xs text-zinc-400">
              Session user: {session.user.id}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Class owner: {classRecord.userId}
            </div>
            <div className="mt-1 text-xs text-zinc-400">Class id: {classRecord.id}</div>
          </div>
        </main>
      </div>
    );
  }

  const documents: DocumentRow[] = await prisma.document.findMany({
    where: { classId: classRecord.id, userId: classRecord.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      processedAt: true,
    },
  });

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-black">
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-normal tracking-tight text-zinc-50">
            {classRecord.title}
          </h1>
          {classRecord.description ? (
            <p className="text-sm text-zinc-400">{classRecord.description}</p>
          ) : null}
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Documents
            </h2>
          </div>

          {documents.length ? (
            <div className="mt-4 grid gap-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-100">
                      {doc.filename}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {formatStatus(doc.status)}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Uploaded {doc.createdAt.toLocaleString()}
                    {doc.processedAt
                      ? ` • Processed ${doc.processedAt.toLocaleString()}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/5 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
              No documents uploaded yet.
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Ask about this class
          </h2>
          <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center gap-2 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
              <input
                type="text"
                placeholder={`Ask a question about ${classRecord.title}...`}
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
