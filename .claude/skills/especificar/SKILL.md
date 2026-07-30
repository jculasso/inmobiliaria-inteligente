---
name: especificar
description: Escribe la especificación de un módulo o de un cambio de reglas — matriz de roles, reglas numeradas y comprobables, casos borde, fuera de alcance y criterio de aceptación. Cada regla numerada es después un test. Usar después de indagar y antes de plan-tecnico.
---

# Escribir la especificación

Una regla que no se puede comprobar no es una regla: es una intención. Esta
skill convierte lo que se acordó en frases **falsables**, porque son las que
después se pueden convertir en tests.

Regla de oro: **cada regla numerada tiene que poder fallar.** Si no se te
ocurre cómo verificar que está mal, todavía no es una regla.

## Dónde va

- **Módulo nuevo o cambio grande** → `docs/specs/<modulo>-<detalle>.md`. Sigue
  el hábito que ya existe con `docs/MODULO_PROTOCOLO_5_SEMANAS.md`.
- **Cambio chico** → las mismas secciones, más cortas, en el cuerpo del PR. No
  hace falta un archivo por cada ajuste.

## Las secciones

### Para quién y para qué

Una frase. Quién lo usa y qué problema le saca de encima. Si no entra en una
frase, probablemente son dos cambios.

### Matriz de roles

Tabla con **los cinco roles**, siempre, aunque la mayoría diga "nada". Y las
dos columnas separadas, que no son lo mismo:

| Rol | Qué VE | Qué PUEDE HACER |
|---|---|---|
| `vendedor` | | |
| `team_leader` | | |
| `direccion` | | |
| `admin_tenant` | | |
| `admin_plataforma` | | |

Ver y poder son preguntas distintas — ver `scope.util.ts` y
`CONVENCIONES_TECNICAS.md` §2. Un dato puede estar oculto en la lista y seguir
siendo abrible; eso va escrito, no sobreentendido.

### Reglas de negocio, numeradas

Una por línea, en indicativo y comprobable. Numeradas porque el número es el
que después aparece en el nombre del test.

> 3. El team leader que tiene una punta en una operación **no ve el nombre**
>    del vendedor de la otra punta si ese vendedor no es de su equipo, y esa
>    punta **no suma** a la comisión mostrada.

Mal: *"el team leader ve lo suyo y lo de su equipo"*. Eso no dice qué pasa con
la punta ajena, que es exactamente lo que se codificó mal dos veces.

### Casos borde

Los cuatro que este proyecto olvida:

- **La fila vieja** sin el campo nuevo — enum vacío, null, dato cargado antes
  de que la regla existiera.
- **La lista vacía** — un vendedor sin operaciones, una inmobiliaria sin datos.
- **La punta ajena** — el dato que pertenece a alguien fuera del alcance.
- **La inmobiliaria sin el módulo** — Sanso no tiene todo lo que tiene Vacker.

### Fuera de alcance

Explícito, en lista. Lo que se decidió **no** hacer y por qué.

### Criterio de aceptación

Pasos que el usuario pueda ejecutar él mismo, con nombres y datos reales:
con qué usuario entra, a qué pantalla, qué tiene que ver.

Si un paso requiere que alguien "revise que esté bien", todavía no es un
criterio.

## Del criterio al test

Antes de cerrar, escribí al lado de cada regla numerada **con qué test se
protege**. Si alguna no tiene, o es una regla mal escrita, o falta un test.

Y al corregir un comportamiento que ya existía: el test nuevo tiene que
**fallar contra el código viejo**. Comprobalo. Un test que pasa con y sin el
arreglo no está verificando el arreglo — pasó con los informes en PDF y hubo
que rehacer la medición.

## Al terminar

Pasá a `plan-tecnico`. La spec dice **qué**; el plan dice **en qué orden y en
qué capa**.
