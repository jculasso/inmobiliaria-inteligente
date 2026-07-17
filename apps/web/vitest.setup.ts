import '@testing-library/jest-dom/vitest';

// Env dummy para tests: los módulos de Supabase/API validan estas vars al
// importarse, y en CI no hay un .env real (mismo criterio que
// apps/api/src/config/env.spec.ts).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:3001';
