import { describe, expect, it } from 'vitest';
import { RolSchema } from '@vacker/types';

const ROL_KEYS = RolSchema.options;
import {
  alcanceDeModulo,
  etiquetaDeAlcance,
  puedeEscribirOperaciones,
  puedeBorrarTasaciones,
  puedeGestionarVendedores,
  puedeUsarPublicacion,
  puedeVerTodo,
  puedeVerVendedores,
  rolPrincipal,
  ETIQUETA_ROL,
} from './rbac';

describe('alcanceDeModulo', () => {
  it('vendedor ve su alcance propio', () => {
    expect(alcanceDeModulo(['vendedor'])).toBe('propio');
  });

  it('team_leader ve su equipo', () => {
    expect(alcanceDeModulo(['team_leader'])).toBe('equipo');
  });

  it('dirección ve todo el tenant', () => {
    expect(alcanceDeModulo(['direccion'])).toBe('total');
  });

  it('admin_tenant solo ve', () => {
    expect(alcanceDeModulo(['admin_tenant'])).toBe('ver');
  });

  it('admin_plataforma solo no tiene alcance de tenant', () => {
    expect(alcanceDeModulo(['admin_plataforma'])).toBeNull();
  });

  it('con varios roles, prioriza el más privilegiado', () => {
    expect(alcanceDeModulo(['vendedor', 'direccion'])).toBe('total');
  });
});

describe('etiquetaDeAlcance', () => {
  it('traduce el alcance a texto', () => {
    expect(etiquetaDeAlcance('total')).toBe('Total');
  });
});

describe('rolPrincipal', () => {
  it('prioriza dirección sobre el resto', () => {
    expect(rolPrincipal(['vendedor', 'direccion'])).toBe('direccion');
  });

  it('devuelve null si ningún rol tiene alcance de tenant', () => {
    expect(rolPrincipal(['admin_plataforma'])).toBeNull();
  });
});

describe('puedeVerVendedores', () => {
  it('un vendedor puro no puede', () => {
    expect(puedeVerVendedores(['vendedor'])).toBe(false);
  });

  it('solo direccion y admin_tenant', () => {
    expect(puedeVerVendedores(['direccion'])).toBe(true);
    expect(puedeVerVendedores(['admin_tenant'])).toBe(true);
  });

  // El team leader la tenía hasta el 29/07/2026. Se le sacó por pedido del
  // usuario: el equipo con sus objetivos es información de conducción.
  it('el team leader ya no ve la pantalla de vendedores', () => {
    expect(puedeVerVendedores(['team_leader'])).toBe(false);
  });

  // Si ver y gestionar se separan de nuevo, la pantalla queda a medias: se ve
  // pero no se puede tocar nada, sin ninguna razón visible.
  it('ver y gestionar quedaron en las mismas manos', () => {
    for (const rol of ['vendedor', 'team_leader', 'direccion', 'admin_tenant'] as const) {
      expect(puedeVerVendedores([rol])).toBe(puedeGestionarVendedores([rol]));
    }
  });

  it('admin_plataforma solo no puede', () => {
    expect(puedeVerVendedores(['admin_plataforma'])).toBe(false);
  });
});

describe('puedeGestionarVendedores', () => {
  it('solo direccion y admin_tenant pueden dar de alta/editar/borrar vendedores', () => {
    expect(puedeGestionarVendedores(['direccion'])).toBe(true);
    expect(puedeGestionarVendedores(['admin_tenant'])).toBe(true);
    expect(puedeGestionarVendedores(['team_leader'])).toBe(false);
    expect(puedeGestionarVendedores(['vendedor'])).toBe(false);
  });
});

describe('puedeEscribirOperaciones', () => {
  it('la carga la centraliza la inmobiliaria: solo dirección y admin', () => {
    expect(puedeEscribirOperaciones(['direccion'])).toBe(true);
    expect(puedeEscribirOperaciones(['admin_tenant'])).toBe(true);
  });

  // Hasta el 28/07/2026 estos dos cargaban, y era intencional. Se revirtió por
  // decisión de negocio; el test deja constancia de que hoy NO es un descuido.
  it('ni el vendedor ni el team leader cargan operaciones', () => {
    expect(puedeEscribirOperaciones(['vendedor'])).toBe(false);
    expect(puedeEscribirOperaciones(['team_leader'])).toBe(false);
  });

  it('un team leader que además es dirección sí puede', () => {
    expect(puedeEscribirOperaciones(['team_leader', 'direccion'])).toBe(true);
  });
});

describe('puedeBorrarTasaciones', () => {
  it('un vendedor puro no puede borrar tasaciones', () => {
    expect(puedeBorrarTasaciones(['vendedor'])).toBe(false);
  });

  it('team_leader, direccion y admin_tenant sí pueden', () => {
    expect(puedeBorrarTasaciones(['team_leader'])).toBe(true);
    expect(puedeBorrarTasaciones(['direccion'])).toBe(true);
    expect(puedeBorrarTasaciones(['admin_tenant'])).toBe(true);
  });
});

describe('puedeVerTodo', () => {
  // El check solo aparece para quien le cambia algo. En los dos extremos no
  // haría nada, y un control que no hace nada se prueba una vez y confunde.
  it('lo ven dirección y team leader, que es a quienes les expande el alcance', () => {
    expect(puedeVerTodo(['direccion'])).toBe(true);
    expect(puedeVerTodo(['team_leader'])).toBe(true);
  });

  it('el vendedor no lo ve: ya está en su alcance máximo', () => {
    expect(puedeVerTodo(['vendedor'])).toBe(false);
  });

  it('el admin tampoco: ve todo siempre, tildado o no', () => {
    expect(puedeVerTodo(['admin_tenant'])).toBe(false);
    expect(puedeVerTodo(['admin_plataforma'])).toBe(false);
  });

  it('si además de dirección es admin, gana el admin y el check se oculta', () => {
    expect(puedeVerTodo(['direccion', 'admin_tenant'])).toBe(false);
  });
});

describe('puedeUsarPublicacion', () => {
  it('lo usa quien tiene el rol publicador', () => {
    expect(puedeUsarPublicacion(['publicador'])).toBe(true);
  });

  // Los admins entran sin tener el rol porque son los que van a probar el
  // módulo antes de asignárselo a nadie.
  it('y los admins, que son los que lo van a probar', () => {
    expect(puedeUsarPublicacion(['admin_tenant'])).toBe(true);
    // admin_plataforma faltaba en la lista de la API y el front lo dejaba
    // pasar: 403 disfrazado de error de conexión. Ahora la lista es una sola.
    expect(puedeUsarPublicacion(['admin_plataforma'])).toBe(true);
  });

  // Mientras nadie tenga `publicador`, el módulo queda de hecho apagado para
  // el resto de la inmobiliaria — que es justamente lo que se pidió.
  it('el resto de la inmobiliaria no, ni siquiera dirección', () => {
    expect(puedeUsarPublicacion(['direccion'])).toBe(false);
    expect(puedeUsarPublicacion(['team_leader'])).toBe(false);
    expect(puedeUsarPublicacion(['vendedor'])).toBe(false);
  });
});

describe('catálogo de módulos y roles', () => {
  // Al sumar un módulo o un rol hay varias tablas que enumerarlos: nombre,
  // ícono, ruta, etiqueta. El typecheck ya obliga a completarlas, pero esto
  // deja el motivo escrito para quien vea el error y no entienda por qué.
  it('todo rol tiene etiqueta visible', () => {
    for (const rol of ROL_KEYS) expect(ETIQUETA_ROL[rol]).toBeTruthy();
  });
});
