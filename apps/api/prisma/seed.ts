import { PrismaClient } from '@prisma/client';

// Seed del núcleo (Paso 2): crea el tenant Vacker de forma idempotente.
// Los datos reales 2026 (operaciones, vendedores) se cargan en el Paso 3.
// Corre con el rol `postgres` (BYPASSRLS), fuera del path de negocio.
const prisma = new PrismaClient();

async function main(): Promise<void> {
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
  console.log(`Seed OK — tenant "${tenant.slug}" (${tenant.id})`);
}

main()
  .catch((e: unknown) => {
    console.error('Seed falló:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
