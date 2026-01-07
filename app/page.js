export const dynamic = 'force-dynamic';

export default function Home() {
  const value = process.env.envar1 ?? '';

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>Hostinger env test</h1>
      <p>
        envar1: <strong>{value || '(empty)'}</strong>
      </p>
      <p>
        API: <code>/api/envar1</code>
      </p>
    </main>
  );
}
