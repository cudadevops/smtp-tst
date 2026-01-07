export default function handler(req, res) {
  const value = process.env.envar1 ?? '';
  res.status(200).json({ envar1: value });
}
