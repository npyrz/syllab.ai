import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local (or .env).')
}

function normalizeConnectionString(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const sslMode = url.searchParams.get('sslmode')?.toLowerCase()
    const useLibpqCompat = url.searchParams.get('uselibpqcompat')?.toLowerCase() === 'true'
    const aliasedModes = new Set(['prefer', 'require', 'verify-ca'])

    if (sslMode && aliasedModes.has(sslMode) && !useLibpqCompat) {
      url.searchParams.set('sslmode', 'verify-full')
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

const normalizedConnectionString = normalizeConnectionString(connectionString)

const adapter = new PrismaPg({ connectionString: normalizedConnectionString })

export const prisma = globalThis.__prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
