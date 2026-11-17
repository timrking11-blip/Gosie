const { getDefaultConfig } = require('expo/metro-config');
const http = require('node:http');

const config = getDefaultConfig(__dirname);
const previousMiddleware = config.server.enhanceMiddleware;
// Browser builds use same-origin API cookies; never embed a development URL.
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previousMiddleware ? previousMiddleware(middleware, server) : middleware;
  return (req, res, ...args) => {
    if (!req.url.startsWith('/api/')) return next(req, res, ...args);
    const upstream = http.request({
      host: '127.0.0.1', port: Number(process.env.API_PORT || 8791),
      path: req.url, method: req.method, headers: req.headers,
    }, (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'community_service_unavailable' }));
    });
    req.pipe(upstream);
  };
};
module.exports = config;
