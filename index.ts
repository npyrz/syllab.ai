import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local (or .env).')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'Alice',
      email: 'alice@prisma.io',
    },
  })

  console.log(user)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
