# Copia de seguridad de producción

**Por qué existe esto:** la base está en el plan gratuito de Supabase, que **no
tiene respaldos automáticos**. Hasta que se pague Pro, la única copia es la que
se saque a mano.

```bash
cd apps/api
CUANDO=$(date -u +"%Y-%m-%d_%H%M") node ../../scripts/respaldo/datos.mjs
CUANDO=$(date -u +"%Y-%m-%d_%H%M") node ../../scripts/respaldo/archivos.mjs
```

Los dos **solo leen**. Todo va a `~/Respaldos-Inmobiliaria/<fecha>/`, fuera del
repositorio.

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
