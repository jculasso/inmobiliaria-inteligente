import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../../prisma/tenant-context';
import { FotosService, type FotoFile } from './fotos.service';

const CTX: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['admin_tenant'] };

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

function archivo(buffer: Buffer, mimetype = 'image/jpeg', originalname = 'foto.jpg'): FotoFile {
  return { buffer, mimetype, originalname, size: buffer.length };
}

function armar(cantFotos = 0) {
  const orden: string[] = [];
  let enTransaccion = false;
  const tx = {
    tasacion: {
      findUnique: vi.fn().mockResolvedValue({
        tenantId: 't1',
        agenteId: 'u1',
        _count: { fotos: cantFotos },
      }),
    },
    tasacionFoto: {
      create: vi.fn().mockResolvedValue({ id: 'f1', orden: cantFotos }),
      findFirst: vi.fn().mockResolvedValue({ url: 't1/tas/abc.jpg' }),
      delete: vi.fn(() => {
        orden.push('delete-fila');
      }),
    },
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: typeof tx) => unknown) => {
      enTransaccion = true;
      try {
        return await fn(tx);
      } finally {
        enTransaccion = false;
      }
    }),
  };
  const storage = {
    uploadPrivado: vi.fn(async () => {
      orden.push(enTransaccion ? 'upload-EN-tx' : 'upload');
    }),
    signedUrl: vi.fn().mockResolvedValue('https://firmada'),
    keyDe: vi.fn((_b: string, url: string) => url),
    remove: vi.fn(async () => {
      orden.push(enTransaccion ? 'remove-EN-tx' : 'remove');
    }),
  };
  const svc = new FotosService(db as never, storage as never);
  return { svc, tx, storage, orden };
}

describe('FotosService · formato', () => {
  it('rechaza un archivo que dice ser imagen pero no lo es', async () => {
    const { svc, storage } = armar();
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(svc.subir('tas', archivo(html, 'image/png', 'x.png'), CTX)).rejects.toThrow(
      /PNG, JPG o WebP/,
    );
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('rechaza un SVG', async () => {
    const { svc } = armar();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await expect(
      svc.subir('tas', archivo(svg, 'image/svg+xml', 'x.svg'), CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda con la extensión y el tipo verificados, no con los declarados', async () => {
    const { svc, storage } = armar();
    await svc.subir('tas', archivo(JPG, 'image/gif', 'foto.gif'), CTX);
    const [bucket, path, , tipo] = storage.uploadPrivado.mock.calls[0] as unknown as [
      string,
      string,
      Buffer,
      string,
    ];
    expect(bucket).toBe('tasador-fotos');
    expect(path).toMatch(/^t1\/tas\/[0-9a-f-]+\.jpg$/);
    expect(tipo).toBe('image/jpeg');
  });
});

describe('FotosService · consultas', () => {
  it('cuenta las fotos sin traer la tasación entera', async () => {
    const { svc, tx } = armar();
    await svc.subir('tas', archivo(JPG), CTX);
    const arg = tx.tasacion.findUnique.mock.calls[0]![0] as { select?: unknown; include?: unknown };
    expect(arg.include).toBeUndefined();
    expect(arg.select).toEqual({
      tenantId: true,
      agenteId: true,
      _count: { select: { fotos: true } },
    });
  });

  it('respeta el tope de tres fotos', async () => {
    const { svc } = armar(3);
    await expect(svc.subir('tas', archivo(JPG), CTX)).rejects.toThrow(/máximo de 3/);
  });
});

describe('FotosService · Storage fuera de la transacción', () => {
  it('la subida no ocurre dentro de una transacción', async () => {
    const { svc, orden } = armar();
    await svc.subir('tas', archivo(JPG), CTX);
    expect(orden).toEqual(['upload']);
  });

  it('el archivo se borra después de confirmar el borrado de la fila', async () => {
    const { svc, orden } = armar();
    await svc.eliminar('tas', 'f1', CTX);
    expect(orden).toEqual(['delete-fila', 'remove']);
  });

  it('si Storage falla al borrar, la foto igual queda eliminada', async () => {
    const { svc, storage } = armar();
    storage.remove.mockRejectedValueOnce(new Error('Storage caído'));
    await expect(svc.eliminar('tas', 'f1', CTX)).resolves.toEqual({ id: 'f1' });
  });
});
