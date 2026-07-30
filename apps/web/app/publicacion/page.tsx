import { requireServerPrincipal } from '../../lib/server-principal';
import { puedeUsarPublicacion } from '../../lib/rbac';
import { getCredencial, listarPropiedades } from '../../lib/publicacion-api';
import { CredencialTokko } from '../../components/publicacion/credencial-tokko';
import { PropiedadesTokko } from '../../components/publicacion/propiedades-tokko';

export const metadata = { title: 'Publicación' };

export default async function PublicacionPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  // El módulo puede estar contratado y aun así no ser para todos: publicar es
  // tarea de quien tiene el rol. La API responde 403 igual; esto explica por qué.
  if (!puedeUsarPublicacion(ctx.principal.roles)) {
    return (
      <div className="rounded-brand border border-line bg-white p-6">
        <h2 className="text-base font-bold text-ink">No tenés acceso a Publicación</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Este módulo lo usa quien tiene el rol <strong>Publicador</strong>. Si te corresponde, pedile a
          la administración de tu inmobiliaria que te lo asigne.
        </p>
      </div>
    );
  }

  const [credencial, propiedades] = await Promise.all([
    getCredencial(ctx.accessToken),
    listarPropiedades(ctx.accessToken),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <CredencialTokko inicial={credencial} />
      {credencial.configurada && <PropiedadesTokko inicial={propiedades} />}
    </div>
  );
}
