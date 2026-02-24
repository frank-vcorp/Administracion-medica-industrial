
import { PrismaClient, EventStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🧪 Starting AI Integration Verification...')

    // 3. TEST PYTHON ENDPOINT DIRECTLY
    console.log('🧠 Testing Python Brain...')

    try {
        // Direct call to localhost:8000 (Forwarded from docker)
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: '/uploads/test_audiometria_dummy.pdf' })
        })

        const result = await response.json()
        console.log('🧠 AI Response:', result)

        if (result.classification && result.classification.detected_type === 'AUDIOMETRIA') {
            console.log('✅ AI Classified correctly: AUDIOMETRIA')
        } else {
            console.error('❌ AI Classification Mismatch or Failed')
        }

    } catch (e) {
        console.error('❌ Could not talk to Python:', e)
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
