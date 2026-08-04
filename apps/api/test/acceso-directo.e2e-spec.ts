import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { TABLAS } from './aislamiento.fixtures';

/**
 * Guardia estática: nadie consulta una tabla con RLS por fuera de `withTenant`.
 *
 * Los tests de aislamiento prueban que `TenantPrismaService.withTenant` aísla
 * bien. Lo que NO prueban es que el código lo use. Un servicio nuevo que
 * consulte con `PrismaService` directo compila, devuelve datos y se ve
 * correcto — solo que devuelve los de TODAS las inmobiliarias. No hay síntoma.
 *
 * Lo estructural que frenaría eso es `FORCE ROW LEVEL SECURITY`, que hoy no se
 * puede aplicar: la base productiva no tiene copias de seguridad (ver §20.6 del
 * documento de arquitectura). Mientras tanto, este test es lo que hay.
 *
 * ── Cómo distingue un cliente del otro ──────────────────────────────────────
 *
 * No por el nombre de la variable, que se puede cambiar, sino por el TIPO.
 * Prisma declara el cliente transaccional como
 * `Omit<PrismaClient, '$transaction' | '$connect' | ...>`, así que:
 *
 *   this.prisma.operacion   → receptor `PrismaService`     → tiene $transaction
 *   tx.operacion            → receptor `TransactionClient` → NO tiene
 *
 * Preguntarle al checker por `$transaction` separa los dos casos sin listas de
 * nombres. Y como el tipo viaja con la variable, `const db = this.prisma` o un
 * parámetro `(p: PrismaService)` caen igual: la indirección no lo esquiva.
 *
 * ── Lo que NO detecta ───────────────────────────────────────────────────────
 *
 * Está documentado en `docs/CONVENCIONES_TECNICAS.md` §18 y conviene leerlo
 * antes de confiar en este test más de lo que da. En resumen: contexto forjado
 * (`withTenant(fn, { tenantId: otro })`), tipos borrados con `as any`, y acceso
 * dinámico con una variable como clave.
 */

/** `apps/api`. Vitest corre con `root: '.'` desde el paquete. */
const RAIZ = process.cwd();

/**
 * Los dos únicos archivos que legítimamente tienen el cliente crudo en la mano:
 * `PrismaService` es el cliente, y `TenantPrismaService` es el que lo envuelve.
 * Se excluyen por ruta exacta, no por carpeta, para que un servicio escondido
 * en `src/prisma/` no herede la exención.
 */
const ARCHIVOS_DEL_MECANISMO = [
  'src/prisma/prisma.service.ts',
  'src/prisma/tenant-prisma.service.ts',
];

/**
 * Excepciones. Cada una es una decisión, no un trámite.
 *
 * Se ancla por **archivo + función**, no por número de línea: las líneas se
 * corren con cualquier import que se agregue arriba y la exención terminaría
 * apuntando a otro lado. Si alguien renombra la función o mueve el código, este
 * test se pone rojo — que es la falla correcta, porque obliga a mirar.
 */
interface Excepcion {
  archivo: string;
  /**
   * Los nombres de las funciones exentas, o `'*'` para el archivo entero.
   *
   * El comodín es para los servicios que son cross-tenant **de punta a punta**,
   * donde enumerar veinte métodos sería ruido. Tiene un costo real y conviene
   * tenerlo presente: un método nuevo en ese archivo nace exento. Se justifica
   * solo cuando el archivo completo cuelga de `@Roles('admin_plataforma')`, que
   * es un rol que vive fuera de las inmobiliarias.
   */
  funciones: string[] | '*';
  motivo: string;
}

const PERMITIDOS: Excepcion[] = [
  {
    archivo: 'src/auth/auth.guard.ts',
    funciones: ['constructor', 'resolvePrincipal'],
    motivo:
      'Busca al usuario por authUserId para averiguar de qué inmobiliaria es. ' +
      'Es la consulta que RESUELVE el tenant: todavía no hay ninguno que declarar, ' +
      'así que no puede pasar por withTenant sin caer en un círculo.',
  },
  {
    archivo: 'src/modules/tareas/tareas.service.ts',
    funciones: ['constructor', 'enviarReportesSemanales'],
    motivo:
      'El cron del reporte semanal recorre TODAS las inmobiliarias, por diseño y ' +
      'sin sesión de nadie. Lee la lista de tenants y un usuario de cada uno; a ' +
      'partir de ahí cada reporte sí se arma dentro de withTenant con ese contexto.',
  },
  {
    archivo: 'src/admin/admin-tenants.service.ts',
    funciones: '*',
    motivo:
      'Consola de plataforma: da de alta y administra las inmobiliarias mismas. ' +
      'Cruza tenants por definición y withTenant sería incorrecto acá, porque no ' +
      'hay UN tenant al que acotarse. Los ocho endpoints que lo exponen son ' +
      '@Roles("admin_plataforma"), un rol que vive fuera de las inmobiliarias.',
  },
  {
    archivo: 'src/admin/admin-usuarios.service.ts',
    funciones: '*',
    motivo:
      'Consola de plataforma: crea usuarios con acceso real (cuenta de Supabase ' +
      'Auth + perfil) en cualquier inmobiliaria. Mismo caso y misma protección que ' +
      'admin-tenants: los siete endpoints son @Roles("admin_plataforma").',
  },
  {
    archivo: 'src/me/password.service.ts',
    funciones: ['constructor', 'cambiar'],
    motivo:
      'Cambio de la propia contraseña. A diferencia de los de admin, este SÍ podría ' +
      'pasar por withTenant —el principal trae tenantId— y se eligió no hacerlo. Es ' +
      'seguro porque el where filtra por `principal.userId`, que sale del token ya ' +
      'verificado y no de la request. Queda anotado por función, no con comodín, ' +
      'justamente porque el argumento es de corrección y no de diseño: si el archivo ' +
      'crece, que el método nuevo tenga que justificarse solo.',
  },
];

/** Métodos de SQL crudo: esquivan los delegados y por lo tanto la regla A. */
const SQL_CRUDO = ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe'];

/** Los modelos con RLS, tomados de la lista que la guardia de esquema mantiene al día. */
const MODELOS_CON_RLS = new Set(TABLAS.map((t) => t.modelo));

interface Hallazgo {
  archivo: string;
  linea: number;
  funcion: string;
  regla: 'A' | 'B' | 'C';
  detalle: string;
}

/**
 * La función con nombre que contiene al nodo. Las flechas anónimas —el callback
 * de `withTenant`, un `.map(...)`— se saltean y se sigue subiendo, porque lo que
 * identifica al lugar es el método, no el closure.
 */
function funcionContenedora(nodo: ts.Node): string {
  let n: ts.Node | undefined = nodo.parent;
  while (n) {
    if (ts.isConstructorDeclaration(n)) return 'constructor';
    if (
      (ts.isMethodDeclaration(n) || ts.isFunctionDeclaration(n)) &&
      n.name &&
      ts.isIdentifier(n.name)
    ) {
      return n.name.text;
    }
    if (ts.isPropertyDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    n = n.parent;
  }
  return '<nivel de módulo>';
}

/** ¿El tipo es el cliente crudo? Se pregunta por lo que el transaccional NO tiene. */
function esClienteCrudo(tipo: ts.Type): boolean {
  return tipo.getProperty('$transaction') !== undefined;
}

/** `OperacionDelegate<...>` → `operacion`. Devuelve null si no es un delegado. */
function modeloDelDelegado(nombreDeTipo: string): string | null {
  const m = /^(\w+)Delegate[<$]/.exec(nombreDeTipo);
  if (!m) return null;
  return m[1]!.charAt(0).toLowerCase() + m[1]!.slice(1);
}

function analizar(): { hallazgos: Hallazgo[]; archivosVistos: number; usadas: Set<string> } {
  const cfg = ts.readConfigFile(resolve(RAIZ, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, RAIZ);
  const programa = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = programa.getTypeChecker();

  const hallazgos: Hallazgo[] = [];
  const usadas = new Set<string>();
  let archivosVistos = 0;

  for (const sf of programa.getSourceFiles()) {
    if (sf.isDeclarationFile || sf.fileName.includes('node_modules')) continue;

    const rel = relative(RAIZ, sf.fileName).replace(/\\/g, '/');

    // Solo código de producción. Los `.spec.ts` de `src/` quedan fuera a
    // propósito: usan dobles y no se despliegan. Es un punto ciego conocido.
    if (!rel.startsWith('src/')) continue;
    if (/\.spec\.tsx?$/.test(rel)) continue;
    if (ARCHIVOS_DEL_MECANISMO.includes(rel)) continue;

    archivosVistos++;

    const anotar = (nodo: ts.Node, regla: Hallazgo['regla'], detalle: string) => {
      const funcion = funcionContenedora(nodo);
      const permiso = PERMITIDOS.find(
        (p) =>
          p.archivo === rel && (p.funciones === '*' || p.funciones.includes(funcion)),
      );
      if (permiso) {
        usadas.add(permiso.funciones === '*' ? `${rel}::*` : `${rel}::${funcion}`);
        return;
      }
      hallazgos.push({
        archivo: rel,
        linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
        funcion,
        regla,
        detalle,
      });
    };

    const visitar = (nodo: ts.Node): void => {
      // ── Regla A · acceso a un modelo con RLS sobre el cliente crudo ──
      // Cubre `x.operacion` y `x['operacion']` por igual: lo que se mira es el
      // tipo del nodo, no cómo se escribió el acceso.
      if (ts.isPropertyAccessExpression(nodo) || ts.isElementAccessExpression(nodo)) {
        const modelo = modeloDelDelegado(checker.typeToString(checker.getTypeAtLocation(nodo)));
        if (modelo && MODELOS_CON_RLS.has(modelo)) {
          if (esClienteCrudo(checker.getTypeAtLocation(nodo.expression))) {
            anotar(nodo, 'A', `consulta el modelo \`${modelo}\` con el cliente crudo`);
          }
        }
      }

      // ── Regla C · SQL crudo sobre el cliente crudo ──
      // `tx.$queryRawUnsafe(...)` dentro de withTenant es legítimo y no cae acá:
      // el receptor es TransactionClient y corre como `authenticated`.
      if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)) {
        const metodo = nodo.expression.name.text;
        if (
          SQL_CRUDO.includes(metodo) &&
          esClienteCrudo(checker.getTypeAtLocation(nodo.expression.expression))
        ) {
          anotar(nodo, 'C', `ejecuta \`${metodo}\` con el cliente crudo (esquiva RLS entera)`);
        }
      }

      // ── Regla B · inyección de PrismaService en un servicio de negocio ──
      if (ts.isParameter(nodo) || ts.isPropertyDeclaration(nodo)) {
        const nombre = checker.getTypeAtLocation(nodo).getSymbol()?.getName();
        if (nombre === 'PrismaService' || nombre === 'PrismaClient') {
          anotar(nodo, 'B', `recibe \`${nombre}\`; debería recibir \`TenantPrismaService\``);
        }
      }

      ts.forEachChild(nodo, visitar);
    };

    ts.forEachChild(sf, visitar);
  }

  return { hallazgos, archivosVistos, usadas };
}

const analisis = analizar();

describe('Acceso a Prisma fuera del contexto de tenant (análisis estático)', () => {
  it('el análisis efectivamente recorrió el código de la API', () => {
    // Sin esto, cualquier error de rutas dejaría el programa vacío y las tres
    // comprobaciones de abajo pasarían por no haber mirado nada.
    expect(existsSync(resolve(RAIZ, 'src/prisma/tenant-prisma.service.ts'))).toBe(true);
    expect(analisis.archivosVistos).toBeGreaterThan(50);
    expect(MODELOS_CON_RLS.size).toBe(16);
  });

  it('ningún archivo de src/ consulta una tabla con RLS por fuera de withTenant', () => {
    const informe = analisis.hallazgos
      .map(
        (h) =>
          `  [regla ${h.regla}] ${h.archivo}:${h.linea}  (${h.funcion})\n` +
          `      ${h.detalle}`,
      )
      .join('\n');

    expect(
      analisis.hallazgos,
      analisis.hallazgos.length
        ? `Se encontró acceso a Prisma sin contexto de inmobiliaria:\n\n${informe}\n\n` +
            `Estas consultas ven los datos de TODAS las inmobiliarias. Pasalas por ` +
            `\`TenantPrismaService.withTenant()\`, que baja el rol a \`authenticated\` y ` +
            `deja que RLS filtre. Si el caso es legítimo —resolver el tenant antes de ` +
            `tenerlo, o un cron que recorre todos— agregalo a PERMITIDOS en este archivo ` +
            `con el motivo escrito.`
        : '',
    ).toEqual([]);
  });

  it('todas las excepciones de la lista blanca siguen apuntando a código real', () => {
    // Una exención que ya no corresponde a nada es basura que aparenta cobertura.
    // Si alguien renombra `resolvePrincipal`, esto avisa en vez de dejarlo pasar.
    const huerfanas = PERMITIDOS.flatMap((p) =>
      (p.funciones === '*' ? ['*'] : p.funciones)
        .map((f) => `${p.archivo}::${f}`)
        .filter((clave) => !analisis.usadas.has(clave)),
    );

    expect(
      huerfanas,
      huerfanas.length
        ? `Estas excepciones ya no coinciden con ningún acceso: ${huerfanas.join(', ')}. ` +
            `O el código se movió o se renombró la función. Actualizá PERMITIDOS o ` +
            `sacá la entrada.`
        : '',
    ).toEqual([]);
  });
});
