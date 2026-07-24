import { Suspense } from 'react';
import { TodoView } from '../../components/todo/todo-view';

export default function TodoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <TodoView />
    </Suspense>
  );
}
