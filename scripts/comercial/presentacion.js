const pptxgen = require('pptxgenjs');
const path = require('node:path');

/*
 * Presentación comercial — DOS módulos: Tablero Comercial y Tasador.
 *
 * A quién le habla: al dueño o director de una inmobiliaria, no a un jefe de
 * sistemas. Cada lámina se titula con la PREGUNTA que él se hace y la contesta
 * en una línea antes de abrir el detalle.
 *
 * El vocabulario es el suyo: facturación, ticket promedio, puntas, margen,
 * flujo de caja, tasa de captación. No «KPIs» ni «dashboards».
 *
 *     pnpm presentacion              → el deck completo
 *     pnpm presentacion -- --sueltas  → cinco archivos de una lámina, que es
 *                                       la única manera de VERLAS: acá no hay
 *                                       LibreOffice y la vista previa del
 *                                       sistema solo dibuja la primera hoja de
 *                                       cada archivo.
 */

const D = __dirname;
const CAP =
  '/Users/javierculasso/Documents/Claude/Projects/Inmobiliaria-Inteligente/apps/sitio/public/capturas';

const AZUL = '173F6B';
const AZUL_OSC = '0F2A4A';
const AZUL_CLARO = '6E8FB5';
const TINTA = '1D1D1F';
const GRIS = '6B6B6B';
const LINEA = 'E6E6E6';
const FONDO = 'F4F5F7';
const BLANCO = 'FFFFFF';
const CLARO = 'C9D3E0';

/* Figtree: la tipografía de la plataforma, la misma del sitio. PowerPoint no la
   incrusta — para presentar desde otra computadora, exportar a PDF. */
const F = 'Figtree';

const LAMINAS = [];
let pres;

/** El isotipo, rasterizado del mismo SVG del sitio (PowerPoint no dibuja SVG). */
function isotipo(s, x, y, lado, sobreOscuro) {
  s.addImage({
    path: path.resolve(D, sobreOscuro ? 'isotipo-blanco.png' : 'isotipo-azul.png'),
    x, y, w: lado, h: lado,
  });
}

function marca(s, sobreOscuro = false) {
  isotipo(s, 0.5, 0.31, 0.19, sobreOscuro);
  s.addText('INMOBILIARIA INTELIGENTE', {
    x: 0.77, y: 0.29, w: 4, h: 0.23, margin: 0,
    fontFace: F, fontSize: 8, bold: true, charSpacing: 1.7,
    color: sobreOscuro ? BLANCO : AZUL, valign: 'middle',
  });
}

/**
 * El encabezado: número, la PREGUNTA y su respuesta en una línea.
 *
 * La pregunta es lo más grande de la hoja a propósito. Un CEO que entra tarde a
 * la reunión tiene que saber de qué se trata sin leer nada más.
 */
function pregunta(s, n, texto, respuesta, sobreOscuro = false) {
  s.addText(`0${n}`, {
    x: 0.5, y: 0.93, w: 0.5, h: 0.3, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: sobreOscuro ? AZUL_CLARO : CLARO,
  });
  s.addText(texto, {
    x: 0.98, y: 0.82, w: 8.5, h: 0.56, margin: 0,
    fontFace: F, fontSize: 32, bold: true, color: sobreOscuro ? BLANCO : AZUL,
  });
  s.addText(respuesta, {
    x: 0.98, y: 1.46, w: 8.4, h: 0.56, margin: 0,
    fontFace: F, fontSize: 14, bold: true,
    color: sobreOscuro ? CLARO : TINTA, lineSpacing: 19,
  });
  s.addShape(pres.ShapeType.line, {
    x: 0.5, y: 2.16, w: 9, h: 0, line: { color: sobreOscuro ? '2C4E75' : LINEA, width: 1 },
  });
  s.addText(`${n} / 5`, {
    x: 9.1, y: 5.15, w: 0.6, h: 0.25, margin: 0, align: 'right',
    fontFace: F, fontSize: 9, color: sobreOscuro ? '3E5A7C' : LINEA,
  });
}

/*
 * UN SOLO SISTEMA DE LISTAS PARA TODO EL DECK.
 *
 * Antes había tres: la lámina 1 usaba un punto de 0,06 con sangría de 0,20 y
 * una barra azul vertical que no aparecía en ninguna otra; la 2, un punto de
 * 0,10 con sangría de 0,26; la 4, un número con sangría de 0,50. Tres tamaños
 * de marca, tres sangrías y tres escalas tipográficas para decir lo mismo.
 *
 * Ahora todas las filas comparten el hueco de la marca y la sangría del texto.
 * Lo único que cambia es QUÉ va en el hueco: un punto si la lista no tiene
 * orden, un número si es una secuencia y el orden importa.
 */
const MARCA = 0.42; // el hueco de la marca: lo pide el «01», el punto entra de sobra

/**
 * La marca de una fila: un número si hay orden, un punto si no.
 *
 * El número se apoya a la IZQUIERDA del hueco y el punto a la DERECHA, pegado
 * al texto. Suena caprichoso y no lo es: un «01» necesita todo el hueco, un
 * punto no, y centrarlo o alinearlo a la izquierda lo deja flotando a media
 * pulgada de su propia frase — que es exactamente lo que se veía mal.
 *
 * Lo que se mantiene igual en las cinco láminas es dónde ARRANCA EL TEXTO. Eso
 * es lo que hace que se lean como una sola presentación; la marca solo tiene
 * que quedar bien al lado de lo suyo.
 */
function marcaDeFila(s, x, y, numero, sobreOscuro) {
  const color = sobreOscuro ? AZUL_CLARO : AZUL;
  if (numero) {
    s.addText(numero, {
      x, y, w: MARCA - 0.08, h: 0.26, margin: 0, align: 'left',
      fontFace: F, fontSize: 12, bold: true, color,
    });
  } else {
    s.addShape(pres.ShapeType.ellipse, {
      x: x + MARCA - 0.23, y: y + 0.095, w: 0.095, h: 0.095,
      fill: { color }, line: { type: 'none' },
    });
  }
}

/**
 * Una fila con título y descripción. Es la unidad de todo el deck.
 *
 * `paso` lo decide quien la llama porque no todas las listas respiran igual,
 * pero el hueco de la marca y la sangría del texto NO son negociables: son lo
 * que hace que cinco láminas se lean como una sola presentación.
 */
function fila(s, { x, y, ancho, numero, titulo, texto, sobreOscuro }) {
  marcaDeFila(s, x, y, numero, sobreOscuro);
  s.addText(titulo, {
    x: x + MARCA, y, w: ancho - MARCA, h: 0.26, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: sobreOscuro ? BLANCO : TINTA,
  });
  if (texto) {
    s.addText(texto, {
      x: x + MARCA, y: y + 0.25, w: ancho - MARCA, h: 0.26, margin: 0,
      fontFace: F, fontSize: 9.5, color: sobreOscuro ? CLARO : GRIS,
    });
  }
}

/**
 * Una fila de un solo renglón, para las listas donde cada ítem es una frase y
 * no un título con su explicación. Misma marca y misma sangría que `fila`.
 */
function filaSimple(s, x, y, ancho, texto, sobreOscuro) {
  marcaDeFila(s, x, y, null, sobreOscuro);
  s.addText(texto, {
    x: x + MARCA, y, w: ancho - MARCA, h: 0.26, margin: 0,
    fontFace: F, fontSize: 10, color: sobreOscuro ? CLARO : TINTA,
  });
}

/**
 * El encabezado de un bloque: filete azul arriba y el nombre debajo.
 *
 * Es el mismo device que usan las dos personas de la lámina 5. Reaparece en la
 * 1 para los dos módulos, en vez de la barra vertical que estaba solo ahí.
 */
function bloque(s, x, y, ancho, titulo, subtitulo) {
  s.addShape(pres.ShapeType.line, {
    x, y, w: ancho, h: 0, line: { color: AZUL, width: 2 },
  });
  s.addText(titulo, {
    x, y: y + 0.11, w: ancho, h: 0.3, margin: 0,
    fontFace: F, fontSize: 14, bold: true, color: TINTA,
  });
  if (subtitulo) {
    s.addText(subtitulo, {
      x, y: y + 0.42, w: ancho, h: 0.24, margin: 0,
      fontFace: F, fontSize: 10.5, bold: true, color: AZUL,
    });
  }
}

function captura(s, archivo, opciones) {
  s.addImage({
    path: `${CAP}/${archivo}`,
    ...opciones,
    shadow: { type: 'outer', color: '1D1D1F', opacity: 0.22, blur: 18, offset: 6, angle: 90 },
  });
}

/* ═══════════ 01 · ¿Qué es? ═══════════ */
LAMINAS.push(function laminaQueEs() {
  const s = pres.addSlide();
  s.background = { color: BLANCO };
  marca(s);
  pregunta(
    s, 1, '¿Qué es?',
    'Un tablero comercial y un CRM de tasaciones, sobre el sistema que ya usa.',
  );

  /*
   * VIÑETAS y no un párrafo corrido.
   *
   * Lo que mide el tablero es una LISTA — facturación, ranking, ticket, puntas,
   * comisión, flujo de caja, alquileres— y en prosa se leía como un bloque de
   * seis renglones que nadie termina. En una reunión, además, el que presenta
   * necesita poder señalar un renglón.
   */
  const DEL_TABLERO = [
    'Facturación anual, trimestral y mensual, de la inmobiliaria y de cada vendedor',
    'Ranking de vendedores, ticket promedio, operaciones y puntas',
    'La comisión generada, y qué parte todavía no entró en caja',
    'Operaciones señadas: el flujo de caja que viene',
    'Contratos de alquileres firmados',
  ];
  const DEL_TASADOR = [
    'Cada tasación con su valor, su estado y el vendedor a cargo',
    'Cuando no se capta, queda escrito el motivo',
    'El informe que su vendedor le deja al propietario',
  ];

  bloque(s, 0.5, 2.4, 5.3, 'Tablero Comercial');
  DEL_TABLERO.forEach((t, i) => filaSimple(s, 0.5, 2.82 + i * 0.28, 5.3, t));
  bloque(s, 0.5, 4.36, 5.3, 'Tasador');
  DEL_TASADOR.forEach((t, i) => filaSimple(s, 0.5, 4.78 + i * 0.28, 5.3, t));

  captura(s, 'tablero-kpis.png', { x: 6.15, y: 2.62, w: 3.35, h: 2.09 });
  // Un renglón, no dos: con dos, la segunda línea terminaba debajo del «1 / 5».
  s.addText('El mes y el año, y lo que todavía falta cobrar.', {
    x: 6.15, y: 4.84, w: 3.35, h: 0.3, margin: 0,
    fontFace: F, fontSize: 9, color: GRIS,
  });

  s.addNotes(
    'Abrir contestando la pregunta, no describiendo el software. «Sobre el sistema que ya usa» ' +
      'es la frase que desarma la primera objeción: nadie quiere reemplazar su CRM. Las viñetas ' +
      'se leen señalando; no hace falta decirlas todas, sí parar en el flujo de caja, que es la ' +
      'que menos esperan. Las capturas son de una inmobiliaria de demostración, nunca de un ' +
      'cliente real.',
  );
});

/* ═══════════ 02 · ¿Para qué sirve? ═══════════ */
LAMINAS.push(function laminaParaQue() {
  const s = pres.addSlide();
  s.background = { color: BLANCO };
  marca(s);
  pregunta(
    s, 2, '¿Para qué sirve?',
    'Para tomar cinco decisiones con el número delante, y no con la impresión de la semana.',
  );

  const puntos = [
    ['Cómo viene el año', 'Proyección anual y trimestral, contra el mismo período del año pasado.'],
    ['Dónde está el margen', 'La comisión real por operación y por punta, no solamente el volumen.'],
    ['Quién produce', 'Operaciones, puntas y comisión de cada vendedor, en un mismo ranking.'],
    ['Toda la captación junta', 'Cada tasación con su estado y su responsable, sin planillas paralelas.'],
    ['La tasa de captación', 'Cuántas tasaciones terminan en captación, y por qué se pierden las otras.'],
  ];
  puntos.forEach(([titulo, texto], i) =>
    fila(s, { x: 0.5, y: 2.44 + i * 0.6, ancho: 5.2, titulo, texto }),
  );

  captura(s, 'tasador-tasaciones.png', { x: 6.0, y: 2.46, w: 3.5, h: 2.19 });
  s.addText(
    'Cada tasación con su estado. Cuando se pierde, queda escrito por qué — y esa es la ' +
      'conversación que hoy no se tiene.',
    { x: 6.0, y: 4.8, w: 3.5, h: 0.6, margin: 0, fontFace: F, fontSize: 9.5, color: GRIS, lineSpacing: 13 },
  );

  s.addNotes(
    'Acá el CEO se tiene que reconocer. Leer las cinco y parar en la última: casi ninguna ' +
      'inmobiliaria mide la tasa de captación, y es la que separa a un equipo que tasa bien de ' +
      'uno que junta visitas. Si pregunta cómo se calcula: tasaciones presentadas contra ' +
      'captadas, con el motivo cargado en las que se pierden.',
  );
});

/* ═══════════ 03 · ¿Por qué contratarlo? ═══════════ */
LAMINAS.push(function laminaPorQue() {
  const s = pres.addSlide();
  s.background = { color: FONDO };
  marca(s);
  pregunta(
    s, 3, '¿Por qué contratarlo?',
    'Porque hoy esas respuestas cuestan una semana de planilla, y llegan tarde.',
  );

  const razones = [
    [
      'Más eficiencia,\nmás rentabilidad.',
      'El margen deja de ser una estimación: se ve la comisión real por operación, por punta y ' +
        'por vendedor, y qué parte de lo vendido todavía no se cobró. Con eso se decide dónde ' +
        'poner el equipo y qué negocio conviene tomar.',
    ],
    [
      'La información sensible\ndel negocio, con usted.',
      'Se instala en el teléfono como una aplicación más, sin pasar por App Store ni Google ' +
        'Play. Y deja de haber una planilla con la facturación dando vueltas por WhatsApp: ' +
        'cada uno ve lo suyo y la dirección ve todo.',
    ],
  ];
  razones.forEach(([titulo, texto], i) => {
    const x = 0.5 + i * 2.78;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.46, w: 2.56, h: 2.58, rectRadius: 0.1,
      fill: { color: BLANCO }, line: { color: LINEA, width: 1 },
    });
    // «01» y no «1»: es la misma numeración que los pasos de la lámina 4.
    s.addText(String(i + 1).padStart(2, '0'), {
      x: x + 0.2, y: 2.6, w: 0.4, h: 0.28, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: AZUL,
    });
    s.addText(titulo, {
      x: x + 0.2, y: 2.92, w: 2.18, h: 0.62, margin: 0,
      fontFace: F, fontSize: 12.5, bold: true, color: TINTA, lineSpacing: 16,
    });
    s.addText(texto, {
      x: x + 0.2, y: 3.58, w: 2.18, h: 1.34, margin: 0,
      fontFace: F, fontSize: 9.5, color: GRIS, lineSpacing: 13,
    });
  });

  // 750x1624: el alto sale de dividir el ancho por 0,462. Igualar el alto de
  // las tarjetas los dejaba estirados, y un teléfono deformado se nota.
  captura(s, 'tablero-telefono.png', { x: 6.4, y: 2.46, w: 1.34, h: 2.9 });
  captura(s, 'tasador-telefono.png', { x: 8.0, y: 2.46, w: 1.34, h: 2.9 });

  s.addNotes(
    'Acá conviene sacar el propio teléfono y abrirlo. Es el momento en el que se entiende que ' +
      'no es una planilla más. La frase que suele pegar: la facturación deja de circular por ' +
      'WhatsApp.',
  );
});

/* ═══════════ 04 · ¿Cómo se contrata? ═══════════ */
LAMINAS.push(function laminaComoSeContrata() {
  const s = pres.addSlide();
  s.background = { color: AZUL_OSC };
  marca(s, true);
  pregunta(s, 4, '¿Cómo se contrata?', 'Tres pasos y una firma.', true);

  const pasos = [
    ['Implementación', 'Dos sesiones personalizadas de dos horas.'],
    ['Puesta en marcha', 'Onboarding de la dirección y de los vendedores.'],
    ['Acuerdo de confidencialidad', 'Recíproco: sus datos y los nuestros.'],
  ];
  pasos.forEach(([titulo, texto], i) =>
    fila(s, {
      x: 0.5, y: 2.56 + i * 0.72, ancho: 4.5,
      numero: String(i + 1).padStart(2, '0'),
      titulo, texto, sobreOscuro: true,
    }),
  );

  s.addShape(pres.ShapeType.roundRect, {
    x: 5.35, y: 2.46, w: 4.15, h: 2.66, rectRadius: 0.12,
    fill: { color: BLANCO }, line: { type: 'none' },
  });
  s.addText('PRECIOS', {
    x: 5.62, y: 2.64, w: 3.6, h: 0.22, margin: 0,
    fontFace: F, fontSize: 8.5, bold: true, charSpacing: 1.6, color: GRIS,
  });

  const precios = [
    ['Implementación', 'Por única vez · dos sesiones', 'AR$ 300.000'],
    ['Mensual', 'Incluye dos perfiles de dirección', 'AR$ 150.000'],
    ['Por vendedor', 'Mensual, por cada uno', 'AR$ 10.000'],
  ];
  precios.forEach(([que, detalle, monto], i) => {
    const y = 2.98 + i * 0.6;
    if (i > 0) {
      s.addShape(pres.ShapeType.line, {
        x: 5.62, y: y - 0.1, w: 3.6, h: 0, line: { color: LINEA, width: 1 },
      });
    }
    s.addText(que, {
      x: 5.62, y, w: 2.1, h: 0.24, margin: 0,
      fontFace: F, fontSize: 11.5, bold: true, color: TINTA,
    });
    s.addText(detalle, {
      x: 5.62, y: y + 0.22, w: 2.2, h: 0.22, margin: 0,
      fontFace: F, fontSize: 8.5, color: GRIS,
    });
    s.addText(monto, {
      x: 7.0, y: y + 0.01, w: 2.22, h: 0.32, margin: 0, align: 'right',
      fontFace: F, fontSize: 14.5, bold: true, color: AZUL,
    });
  });

  s.addText('Una inmobiliaria de diez vendedores: AR$ 300.000 una vez, y AR$ 250.000 por mes.', {
    x: 5.62, y: 4.78, w: 3.6, h: 0.3, margin: 0,
    fontFace: F, fontSize: 9, color: GRIS, italic: true,
  });

  s.addNotes(
    'El precio se dice completo y sin rodeos, con el ejemplo de las diez personas — evita que ' +
      'hagan la cuenta mal. El acuerdo de confidencialidad lo ofrecemos nosotros, antes de que ' +
      'lo pidan: es lo que separa esto de un vendedor de software.',
  );
});

/* ═══════════ 05 · ¿Quiénes somos? ═══════════ */
LAMINAS.push(function laminaQuienesSomos() {
  const s = pres.addSlide();
  s.background = { color: BLANCO };
  marca(s);
  pregunta(
    s, 5, '¿Quiénes somos?',
    'Dos directores de sistemas que trabajan juntos desde hace treinta años.',
  );

  const gente = [
    [
      'Javier Culasso',
      'CIO del Año de Argentina, 1999',
      'Cofundador de Entrepids: más de 150 implementaciones de comercio electrónico, CRM y ' +
        'fuerza de ventas. El Palacio de Hierro, Best Buy México, Chedraui, HEB, Arcor, Henkel ' +
        'y BIC. Antes, director de sistemas en Minetti y Cía., Cargill – Granja del Sol y ' +
        'Colorín.',
    ],
    [
      'Bernardo Falconi',
      'Veintiún años en Cargill',
      'Gerente de sistemas del negocio de harinas: siete plantas, tres mil clientes, ' +
        'quinientos usuarios y dos millones de dólares de presupuesto anual. Lideró la ' +
        'integración con Molinos Río de la Plata y el proyecto Año 2000 de todo el negocio.',
    ],
  ];
  gente.forEach(([nombre, cargo, texto], i) => {
    const x = 0.5 + i * 4.62;
    bloque(s, x, 2.52, 4.38, nombre, cargo);
    s.addText(texto, {
      x, y: 3.24, w: 4.38, h: 1.2, margin: 0,
      fontFace: F, fontSize: 9.5, color: GRIS, lineSpacing: 13,
    });
  });

  s.addText(
    'Uno viene del lado comercial: vender, medir, convertir. El otro, del lado de la operación ' +
      'que no se puede caer: continuidad, control, datos que no se pierden. Un sistema para ' +
      'una inmobiliaria necesita las dos cosas.',
    { x: 0.5, y: 4.6, w: 8.4, h: 0.55, margin: 0, fontFace: F, fontSize: 10, color: TINTA, lineSpacing: 13.5 },
  );

  s.addNotes(
    'Cerrar acá y no con el precio. Lo que se vende, para un CEO que compra por recomendación, ' +
      'es que del otro lado hay dos personas que ya manejaron sistemas de los que dependía una ' +
      'empresa entera.',
  );
});

async function escribir(indices, archivo) {
  pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; // 10" x 5.625"
  pres.author = 'Inmobiliaria Inteligente';
  pres.title = 'Inmobiliaria Inteligente — presentación comercial';
  for (const i of indices) LAMINAS[i]();
  await pres.writeFile({ fileName: path.resolve(D, archivo) });
  console.log('  ' + archivo);
}

(async () => {
  if (process.argv.includes('--sueltas')) {
    for (let i = 0; i < LAMINAS.length; i++) await escribir([i], `previa-lamina-${i + 1}.pptx`);
  } else {
    await escribir([0, 1, 2, 3, 4], 'Inmobiliaria-Inteligente-2-modulos.pptx');
  }
})();
