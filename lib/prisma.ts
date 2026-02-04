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

const adapter = new PrismaPg({ connectionString })

export const prisma = globalThis.__prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
