#!/usr/bin/env node

const http = require('http');
const ports = [3002, 3025, 3024];

for (const port of ports) {
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', operationalMode: 'full', capabilities: { ready: true } }));
  }).listen(port, '0.0.0.0', () => {
    console.log(`Mock service listening on ${port}`);
  });
}

setInterval(() => {}, 1000);
