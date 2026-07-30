/**
 * Script para crear/actualizar usuario admin con contraseña conocida
 * Ejecutar: npx tsx scripts/create-new-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@sistema.com';
  const newPassword = 'Admin@2026!'; // Nueva contraseña
  
  console.log('🔧 Creando/actualizando usuario ADMIN...\n');
  
  // Generar hash de nueva contraseña
  const newHash = await bcryptjs.hash(newPassword, 10);
  console.log(`Nuevo hash generado para: "${newPassword}"`);
  
  // Verificar si usuario existe
  const existing = await prisma.user.findUnique({ where: { email } });
  
  if (existing) {
    // Actualizar contraseña existente
    await prisma.user.update({
      where: { id: existing.id },
      data: { 
        hashedPassword: newHash,
        isActive: true,
        role: 'ADMIN'
      }
    });
    console.log(`✅ Usuario ADMIN actualizado:`);
    console.log(`   Email: ${email}`);
    console.log(`   Nueva Password: ${newPassword}`);
    console.log(`   ID: ${existing.id}`);
  } else {
    // Crear nuevo usuario
    const newUser = await prisma.user.create({
      data: {
        email,
        hashedPassword: newHash,
        fullName: 'Administrador Sistema AMI',
        role: 'ADMIN',
        isActive: true
      }
    });
    console.log(`✅ Nuevo usuario ADMIN creado:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   ID: ${newUser.id}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CREDENCIALES PARA LOGIN:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
