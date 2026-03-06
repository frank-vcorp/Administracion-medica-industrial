const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = 'test_vercel@sistema.com'
  const password = 'Test123!'
  const hashedPassword = await bcrypt.hash(password, 10)

  console.log(`Seeding user: ${email}...`)

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        hashedPassword,
        role: 'ADMIN',
        isActive: true,
        fullName: 'Test Vercel User'
      },
      create: {
        email,
        hashedPassword,
        fullName: 'Test Vercel User',
        role: 'ADMIN',
        isActive: true
      },
    })
    console.log(`User created/updated: ${user.email}`)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
