export const dynamic = 'force-dynamic';

export function GET() {
  const value = process.env.envar1 ?? '';
  return Response.json({ envar1: value });
}
