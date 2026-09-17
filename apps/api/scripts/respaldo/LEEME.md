# Copia de seguridad de producción

**Por qué existe esto:** la base está en el plan gratuito de Supabase, que **no
tiene respaldos automáticos**. Hasta que se pague Pro, la única copia es la que
se saque a mano.

```bash
cd apps/api
CUANDO=$(date -u +"%Y-%m-%d_%H%M") node scripts/respaldo/datos.mjs
CUANDO=$(date -u +"%Y-%m-%d_%H%M") node scripts/respaldo/archivos.mjs
```

Los dos **solo leen**. Todo va a `~/Respaldos-Inmobiliaria/<fecha>/`, fuera del
repositorio.

### Por qué viven acá y no en `scripts/` de la raíz

Hasta el 17/09/2026 estaban en `scripts/respaldo/`, y el comando documentado
dejó de funcionar sin que nadie se enterara:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@prisma/client'
imported from .../scripts/respaldo/datos.mjs
```

Node resuelve los paquetes desde la ubicación del ARCHIVO, no desde el
directorio actual. Desde la raíz, `datos.mjs` buscaba `@prisma/client` y no lo
encontraba: pnpm lo tiene solo en `apps/api/node_modules`. Antes andaba de
casualidad, porque estaba izado a la raíz; un `install` lo bajó y la
instrucción quedó rota.

**Por qué no se arregló agregando `@prisma/client` a la raíz**, que era lo
primero que uno piensa: el cliente de Prisma no es un paquete común, se GENERA.
El generado vive en una entrada del store de pnpm cuya clave incluye los peers
(`@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3`). Declararlo en la raíz
sin declarar también `prisma` produce otra entrada distinta, **sin el cliente
generado adentro**, y el script falla de otra manera. Habría que duplicar las
dos dependencias de la API en la raíz para que un script resuelva.

Moverlos acá hace que la dependencia sea real en vez de accidental: el script
necesita el cliente de Prisma de la API y el esquema de la API, así que
pertenece al paquete de la API. `apps/api/scripts/` ya existía para esto.

## Qué copia cada uno, y por qué hacen falta los dos

| | Qué guarda | Sin esto |
|---|---|---|
| `datos.mjs` | Las 17 tablas de `public`, una por archivo JSON | No hay tasaciones, operaciones ni usuarios |
| `archivos.mjs` | Los 4 buckets de Storage | Las filas quedan apuntando a fotos e informes que no existen |

**Las fotos NO están en la base.** `tasacion_foto.url` guarda una ruta dentro de
Supabase Storage, no la imagen. Una copia de la base sola parece completa y no
lo es — es el error que este LEEME existe para evitar.

## Qué NO copia, y hay que saberlo

- **Las cuentas de Supabase Auth.** Los usuarios de la tabla `usuario` tienen su
  `auth_user_id`, pero las credenciales viven en el esquema `auth` de Supabase,
  que esta copia no toca. Restaurando esto, las personas existen pero no pueden
  entrar hasta recrearles el acceso.
- **El esquema de la base.** No hace falta: las migraciones están en el
  repositorio y lo reconstruyen desde cero. `_manifiesto.json` anota cuál era la
  última aplicada, para saber contra qué versión restaurar.

## Cómo se restauraría

1. Base nueva y `pnpm --filter @vacker/api prisma:deploy` hasta la migración que
   diga el manifiesto.
2. Insertar las tablas **en orden de dependencias**: `tenant` → `usuario` →
   `usuario_rol` → el resto.
3. Subir los archivos de `storage/` a los buckets con el mismo nombre y la misma
   ruta.

**Una trampa conocida:** `operacion.codigo_num` es `GENERATED ALWAYS`. Un insert
que incluya esa columna falla. Hay que insertarla con
`OVERRIDING SYSTEM VALUE` o excluir la columna y dejar que se regenere — y si se
regenera, los códigos cambian.

## Es información sensible

Adentro hay datos reales de los clientes de Vacker: nombres, teléfonos,
direcciones, valores de tasación. **No subir a un repositorio, ni a una carpeta
compartida, ni a un drive público.** Aplica el mismo criterio que el acuerdo de
confidencialidad y la Ley 25.326.
