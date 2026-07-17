import { PrismaClient } from '@prisma/client';
import { RolSchema } from '@vacker/types';

// Vincula un usuario ya creado en Supabase Auth (panel → Authentication → Users)
// con una fila `usuario` del tenant Vacker, para poder loguearse en apps/web y
// que GET /me lo resuelva (AuthGuard exige que el id coincida). Idempotente:
// se puede correr de nuevo para cambiar nombre/rol sin duplicar nada.
//
// Uso: TEST_USER_ID=<uuid-de-supabase> TEST_USER_EMAIL=<email> \
//      [TEST_USER_NOMBRE=<nombre>] [TEST_USER_ROL=direccion] \
//      pnpm --filter @vacker/api seed:test-user
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const userId = process.env.TEST_USER_ID;
  const email = process.env.TEST_USER_EMAIL;
  if (!userId || !email) {
    throw new Error('Faltan TEST_USER_ID y/o TEST_USER_EMAIL en el entorno.');
  }

  const nombre = process.env.TEST_USER_NOMBRE ?? email.split('@')[0];
  const rol = RolSchema.parse(process.env.TEST_USER_ROL ?? 'direccion');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vacker' },
    update: {},
    create: {
      nombre: 'Vacker Negocios Inmobiliarios',
      slug: 'vacker',
      plan: 'profesional',
      estado: 'activo',
    },
  });

  const usuario = await prisma.usuario.upsert({
    where: { id: userId },
    update: { nombre, email, estado: 'activo' },
    create: { id: userId, tenantId: tenant.id, nombre, email, estado: 'activo' },
  });

  await prisma.usuarioRol.upsert({
    where: { usuarioId_rol: { usuarioId: usuario.id, rol } },
    update: {},
    create: { usuarioId: usuario.id, rol, tenantId: tenant.id },
  });

  console.log(
    `Usuario de prueba OK — ${email} (${userId}) · tenant "${tenant.slug}" · rol "${rol}"`,
  );
}

main()
  .catch((e: unknown) => {
    console.error('seed-test-user falló:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
