export const metadata = {
  title: 'Hostinger Env',
  description: 'Expose envar1 from the server runtime',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
