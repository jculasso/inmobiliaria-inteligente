// Contratos del módulo To Do List — espejo de solo lectura de Google Calendar.
// Cada usuario ve solo su propio calendario principal. Sin escritura.
import { z } from 'zod';

/** Vista temporal de la agenda. */
export const TodoVistaSchema = z.enum(['dia', 'semana', 'mes']);
export type TodoVista = z.infer<typeof TodoVistaSchema>;

/** Query de la agenda: vista + fecha ancla (YYYY-MM-DD) desde la que se calcula el rango. */
export const TodoEventosQuerySchema = z.object({
  vista: TodoVistaSchema.default('semana'),
  // Fecha ancla en formato YYYY-MM-DD. Si no viene, el backend usa "hoy".
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD')
    .optional(),
});
export type TodoEventosQuery = z.infer<typeof TodoEventosQuerySchema>;

/** Un evento del calendario (mirror del recurso de Google Calendar, reducido). */
export const TodoEventoDtoSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  // ISO 8601. En eventos timed es un datetime con zona; en eventos de día
  // completo es una fecha (YYYY-MM-DD) — usar `todoElDia` para distinguir.
  inicio: z.string(),
  fin: z.string(),
  todoElDia: z.boolean(),
  ubicacion: z.string().nullable(),
  descripcion: z.string().nullable(),
  htmlLink: z.string().nullable(),
});
export type TodoEventoDto = z.infer<typeof TodoEventoDtoSchema>;

/** Respuesta de la agenda: el rango resuelto + los eventos ordenados. */
export const TodoEventosDtoSchema = z.object({
  vista: TodoVistaSchema,
  desde: z.string(), // ISO datetime (inicio del rango)
  hasta: z.string(), // ISO datetime (fin del rango)
  eventos: z.array(TodoEventoDtoSchema),
});
export type TodoEventosDto = z.infer<typeof TodoEventosDtoSchema>;

/** Estado de la conexión con Google del usuario actual. */
export const TodoEstadoDtoSchema = z.object({
  conectado: z.boolean(),
  googleEmail: z.string().nullable(),
});
export type TodoEstadoDto = z.infer<typeof TodoEstadoDtoSchema>;
