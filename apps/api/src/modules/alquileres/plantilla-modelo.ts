/**
 * El modelo con que arranca una inmobiliaria que todavía no cargó su
 * plantilla. Es un punto de partida: se revisa con el abogado de la
 * inmobiliaria antes de usarlo.
 */
export const MODELO_BASE = `# CONTRATO DE LOCACIÓN

Entre {{propietarios}}, en adelante «LA PARTE LOCADORA», y {{inquilinos}}, en adelante «LA PARTE LOCATARIA», convienen en celebrar el presente contrato de locación, que se regirá por las siguientes cláusulas.

## PRIMERA · Objeto
LA PARTE LOCADORA da en locación a LA PARTE LOCATARIA, y esta acepta, el inmueble ubicado en {{propiedad.direccion}}, {{propiedad.ciudad}}, que LA PARTE LOCATARIA declara conocer y recibir en buen estado de conservación.

## SEGUNDA · Plazo
El plazo de la locación es de {{contrato.meses}} meses, desde el {{contrato.inicio}} hasta el {{contrato.fin}}, fecha en que LA PARTE LOCATARIA deberá restituir el inmueble libre de ocupantes y en el estado en que lo recibió, salvo el desgaste por el uso normal.

## TERCERA · Precio
El alquiler mensual inicial es de {{alquiler.inicial}} ({{alquiler.inicial.letras}}), que se paga por mes adelantado del 1 al {{vencimiento.dia}} de cada mes en las oficinas de {{inmobiliaria}} o por transferencia a la cuenta que esta indique.

## CUARTA · Actualización
El precio se actualiza según {{ajuste}}, de acuerdo con los siguientes tramos:
{{tramos}}

## QUINTA · Mora
La falta de pago en término produce la mora automática, sin necesidad de interpelación, y devenga un interés punitorio del {{punitorio}} diario sobre lo adeudado.

## SEXTA · Depósito en garantía
LA PARTE LOCATARIA entrega en este acto {{deposito}} ({{deposito.letras}}) en concepto de depósito en garantía, que se devolverá al finalizar la locación, una vez verificado el estado del inmueble y el pago de todas las obligaciones a su cargo.

## SÉPTIMA · Garantía
{{garantes}} se constituyen en fiadores solidarios, lisos, llanos y principales pagadores de todas las obligaciones de LA PARTE LOCATARIA, con renuncia a los beneficios de excusión y división.

## OCTAVA · Destino y conservación
El inmueble se destina exclusivamente a {{contrato.destino}}. LA PARTE LOCATARIA no puede cederlo ni subalquilarlo, y se obliga a conservarlo en buen estado y a permitir su inspección con aviso previo.

## NOVENA · Servicios e impuestos
Los servicios de luz, gas, agua y las expensas ordinarias están a cargo de LA PARTE LOCATARIA desde la entrega de la posesión; los impuestos que gravan el inmueble y las expensas extraordinarias, a cargo de LA PARTE LOCADORA, salvo pacto en contrario.

## DÉCIMA · Domicilios y jurisdicción
Las partes constituyen domicilio en los indicados al comienzo, donde serán válidas todas las notificaciones, y se someten a los tribunales ordinarios de {{propiedad.ciudad}}.

En prueba de conformidad se firman tantos ejemplares como partes, de un mismo tenor y a un solo efecto, en {{propiedad.ciudad}}, el {{fecha.hoy}}.
`;
