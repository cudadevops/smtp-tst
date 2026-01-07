// Minimal app to expose a specific environment variable
import http from 'http';

const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  const value = process.env.envar1 ?? '';
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ envar1: value }));
});

server.listen(port, () => {
  // Keep logs minimal for hosting panels
  console.log(`listening on ${port}`);
});
