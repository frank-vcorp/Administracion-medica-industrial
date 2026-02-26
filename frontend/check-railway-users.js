const { PrismaClient } = require('@prisma/client');

// Force DATABASE_URL from .env specifically
const DATABASE_URL = "postgresql://postgres:yWHxfRaQMXmoYyYOmNGeaarjKVrqGGWO@switchyard.proxy.rlwy.net:52016/railway";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL,
        },
    },
});

async function main() {
    console.log('🔍 Conectando a Railway...');
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                role: true,
                isActive: true
            }
        });

        if (users.length === 0) {
            console.log('❌ No hay usuarios registrados en la base de datos de Railway.');
        } else {
            console.log('✅ Usuarios encontrados en Railway:');
            users.forEach(u => {
                console.log(`- ${u.email} (${u.role}) | Activo: ${u.isActive}`);
            });
        }
    } catch (error) {
        console.error('❌ Error al conectar con Railway:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
