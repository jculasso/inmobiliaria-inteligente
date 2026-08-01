import type { Metadata } from 'next';
import { Captura } from '../../components/marco';
import { Bloque, PaginaModulo, Paso, Rol } from '../../components/pagina-modulo';

export const metadata: Metadata = {
  title: 'Tablero Comercial — Inmobiliaria Inteligente',
  description:
    'Ventas y alquileres con las dos puntas, comisiones calculadas y objetivos por vendedor. Un solo número, el mismo para todos.',
};

export default function Tablero() {
  return (
    <PaginaModulo
      ruta="/tablero"
      titular="Cuánto se vendió, quién lo vendió y cuánto se cobra."
      bajada="Las operaciones se cargan una sola vez, con las dos puntas, y de ahí sale todo: la facturación del mes, la comisión de cada vendedor, cómo viene contra el objetivo. Sin planilla paralela."
      sale="El número del mes, y el mismo para todos"
    >
      <Bloque kicker="El problema" titulo="Hay tres planillas y ninguna coincide." fondo>
        <p>
          La de la administración tiene la facturación. La del vendedor tiene sus operaciones, con
          otro criterio para las compartidas. La de la dirección tiene lo que le pasaron por
          WhatsApp. Las tres están desactualizadas, y cada reunión empieza discutiendo cuál vale.
        </p>
        <p>
          Después está la pregunta que nadie contesta rápido:{' '}
          <em>¿cómo viene Fulano contra su objetivo?</em> Se contesta, pero tarda tres días y sale
          de armar la planilla de nuevo.
        </p>
        <p className="font-semibold text-ink">
          El problema no es que falten números. Es que sobran versiones del mismo número.
        </p>
      </Bloque>

      <Bloque kicker="Cómo funciona" titulo="Se carga la operación. Lo demás se calcula.">
        <ol className="mt-2 list-none space-y-7 p-0">
          <Paso numero={1} titulo="La operación entra una vez, completa">
            <p>
              Venta o alquiler, la propiedad, el monto, la moneda y{' '}
              <strong className="font-semibold text-ink">las dos puntas</strong>: quién captó y
              quién vendió. Si son dos vendedores distintos, el sistema lo sabe y no hay que
              acordar nada después.
            </p>
          </Paso>
          <Paso numero={2} titulo="Las comisiones salen del reglamento, no de la memoria">
            <p>
              Los porcentajes están configurados una vez, por tipo de operación y por punta. Se
              calculan solos y siempre igual, que es lo que evita la conversación incómoda de fin
              de mes.
            </p>
          </Paso>
          <Paso numero={3} titulo="Los objetivos se miden solos">
            <p>
              Cada vendedor tiene su objetivo del período. El tablero muestra cuánto lleva, cuánto
              le falta y a qué ritmo va — mientras todavía se puede hacer algo, no en el cierre.
            </p>
          </Paso>
          <Paso numero={4} titulo="El ranking pone el mes en una pantalla">
            <p>
              Quién está vendiendo, quién está captando, qué se facturó. Sin exportar nada.
            </p>
          </Paso>
        </ol>
        <Captura
          src="/capturas/tablero-kpis.png"
          ancho={2560}
          alto={1600}
          alt="Tablero Comercial en julio de 2026: volumen de 3.060.000 dólares, ocho operaciones, ticket promedio, puntas y comisión, con el acumulado anual debajo."
          pie="El mes y el acumulado del año en la misma pantalla. Volumen, operaciones, ticket promedio, puntas compradoras y vendedoras, y la comisión ya calculada."
        />
        <Captura
          src="/capturas/tablero-objetivos.png"
          ancho={2560}
          alto={1600}
          alt="Seguimiento de vendedores con sus operaciones y su avance contra el objetivo del periodo."
          pie="Cada vendedor contra su objetivo, mientras todavía se puede hacer algo. No en el cierre del mes."
        />
        <Captura
          src="/capturas/tablero-telefono.png"
          ancho={750}
          alto={1624}
          alt="El Tablero Comercial visto en un teléfono, con los indicadores del mes apilados."
          pie="El tablero en el teléfono, que es donde lo mira un vendedor para saber cómo viene."
          telefono
        />
      </Bloque>

      <Bloque kicker="Quién ve qué" titulo="Lo mismo que en el resto del sistema." fondo>
        <div className="mt-2">
          <Rol rol="Vendedor" ve="Sus operaciones, sus comisiones y su objetivo. No los de los demás." />
          <Rol rol="Team leader" ve="Su equipo completo, con el detalle de cada uno." />
          <Rol rol="Dirección" ve="Toda la inmobiliaria, y la comparación entre equipos." />
        </div>
        <p className="pt-4">
          Esto no es una preferencia de pantalla: cada persona{' '}
          <strong className="font-semibold text-ink">no puede</strong> acceder a lo que no le
          corresponde, y eso está resuelto en la base de datos, no en el diseño de la pantalla.
        </p>
      </Bloque>
    </PaginaModulo>
  );
}
