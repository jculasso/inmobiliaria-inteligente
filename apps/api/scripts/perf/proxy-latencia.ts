import { createServer, connect, type Server, type Socket } from 'node:net';

/**
 * Un proxy TCP que le agrega latencia a una base LOCAL: cada paquete espera la
 * mitad de `rttMs` en cada sentido. Sirve para medir en la máquina lo que en
 * producción cuesta cada viaje entre la API (Render, Oregon) y la base
 * (Supabase, São Paulo): unos 150 ms ida y vuelta.
 *
 * El orden se conserva: todos los paquetes esperan lo mismo y los `setTimeout`
 * con el mismo plazo se disparan en el orden en que se programaron.
 *
 *   pnpm --filter @vacker/api exec tsx scripts/perf/proxy-latencia.ts 54330 127.0.0.1:54329 150
 */
export function proxyConLatencia(
  puerto: number,
  destino: { host: string; port: number },
  rttMs: number,
): Promise<Server> {
  const medio = rttMs / 2;
  const demorar = (de: Socket, a: Socket) => {
    de.on('data', (chunk) => {
      setTimeout(() => {
        if (!a.destroyed) a.write(chunk);
      }, medio);
    });
    de.on('end', () => setTimeout(() => a.end(), medio));
    de.on('error', () => a.destroy());
    de.on('close', () => setTimeout(() => a.destroy(), medio));
  };
  const server = createServer((cliente) => {
    const base = connect(destino.port, destino.host);
    cliente.setNoDelay(true);
    base.setNoDelay(true);
    demorar(cliente, base);
    demorar(base, cliente);
  });
  return new Promise((ok, mal) => {
    server.once('error', mal);
    server.listen(puerto, '127.0.0.1', () => ok(server));
  });
}

// Uso directo desde la línea de comandos.
if (process.argv[1]?.endsWith('proxy-latencia.ts')) {
  const [puerto, destino, rtt] = process.argv.slice(2);
  const [host, port] = (destino ?? '127.0.0.1:54329').split(':');
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('El proxy de latencia es solo para una base local.');
  }
  void proxyConLatencia(
    Number(puerto ?? 54330),
    { host, port: Number(port) },
    Number(rtt ?? 150),
  ).then(() =>
    console.log(`proxy 127.0.0.1:${puerto} → ${host}:${port} con ${rtt ?? 150} ms de ida y vuelta`),
  );
}
