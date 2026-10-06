import { notFound } from 'next/navigation';
import { getCredencialTenant, listTenants, listUsuariosDeTenant } from '../../../../lib/admin-api';
import { sesionServidor } from '../../../../lib/server-principal';
import { UsuariosAdminTable } from '../../../../components/admin/usuarios-admin-table';
import { CredencialTokko } from '../../../../components/admin/credencial-tokko';
import { EncabezadoPagina, Insignia } from '../../../../components/piezas';

export default async function AdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionServidor();
  // El layout ya validó sesión + rol; si esto igual falla es un problema
  // transitorio (ej. timeout hacia el backend) — mejor mostrar el error que
  // devolver una página en blanco sin explicación.
  if (!s) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');

  // Todo en paralelo con `/me`: la página no decide nada según el rol (eso ya
  // lo hizo el layout). Se lista toda la cartera para encontrar una porque la
  // API todavía no tiene un GET por id; son pocas inmobiliarias.
  const [principal, tenants, usuarios, credencial] = await Promise.all([
    s.principal,
    listTenants(s.accessToken),
    listUsuariosDeTenant(s.accessToken, id),
    getCredencialTenant(s.accessToken, id),
  ]);
  if (!principal) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');
  const tenant = tenants.find((t) => t.id === id);
  if (!tenant) notFound();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={
          <>
            {tenant.nombre}
            {tenant.estado === 'activo' ? (
              <Insignia tono="exito">Activo</Insignia>
            ) : (
              <Insignia tono="neutro">Suspendido</Insignia>
            )}
          </>
        }
        volver={{ href: '/admin', texto: 'Inmobiliarias' }}
        detalle={
          <p className="text-sm text-muted">
            Slug: {tenant.slug} · Plan: <span className="capitalize">{tenant.plan}</span>
          </p>
        }
      />

      {/* Va ARRIBA de los usuarios: es configuración de la inmobiliaria, y
          debajo de una tabla de veinte personas quedaba tan abajo que no se
          encontraba. Aparece solo si el módulo está contratado — mostrarla
          siempre haría pensar que falta configurar algo. */}
      {tenant.modulos.publicacion && (
        <div className="max-w-2xl">
          <CredencialTokko tenantId={tenant.id} inicial={credencial} />
        </div>
      )}

      <UsuariosAdminTable tenantId={tenant.id} usuarios={usuarios} />
    </div>
  );
}
