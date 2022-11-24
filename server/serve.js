const child = require('child_process');
const fs = require('fs');
const http = require('http');
const http2 = require('http2');
const path = require('path');
const log = require('@vladmandic/pilogger');
const config = require('../config.json');

// app configuration
// you can provide your server key and certificate or use provided self-signed ones
// self-signed certificate generated using:
// openssl req -x509 -newkey rsa:4096 -nodes -keyout https.key -out https.crt -days 365 -subj "/C=US/ST=Florida/L=Miami/O=@vladmandic"
// client app does not work without secure server since browsers enforce https for webcam access
const options = {
  key: fs.readFileSync('server/https.key'),
  cert: fs.readFileSync('server/https.crt'),
  defaultFolder: 'client',
  defaultFile: 'index.html',
  httpPort: config.server.httpPort,
  httpsPort: config.server.httpsPort,
};

// just some predefined mime types
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.m3u8': 'application/x-mpegURL',
  '.ts': 'video/MP2T',
  '.mpd': 'application/dash+xml',
};

function handle(uri) {
  const url = uri.split(/[?#]/)[0];
  const result = { ok: false, stat: {}, file: '' };
  const checkFile = (f) => {
    result.file = f;
    if (fs.existsSync(f)) {
      result.stat = fs.statSync(f);
      if (result.stat.isFile()) {
        result.ok = true;
        return true;
      }
    }
    return false;
  };
  const checkFolder = (f) => {
    result.file = f;
    if (fs.existsSync(f)) {
      result.stat = fs.statSync(f);
      if (result.stat.isDirectory()) {
        result.ok = true;
        return true;
      }
    }
    return false;
  };
  return new Promise((resolve) => {
    if (checkFile(path.join(process.cwd(), url))) resolve(result);
    else if (checkFile(path.join(process.cwd(), url, options.defaultFile))) resolve(result);
    else if (checkFile(path.join(process.cwd(), options.defaultFolder, url))) resolve(result);
    else if (checkFile(path.join(process.cwd(), options.defaultFolder, url, options.defaultFile))) resolve(result);
    else if (checkFolder(path.join(process.cwd(), url))) resolve(result);
    else if (checkFolder(path.join(process.cwd(), options.defaultFolder, url))) resolve(result);
    else resolve(result);
  });
}

// process http requests
async function httpRequest(req, res) {
  handle(decodeURI(req.url)).then((result) => {
    // get original ip of requestor, regardless if it's behind proxy or not
    const forwarded = (req.headers['forwarded'] || '').match(/for="\[(.*)\]:/);
    const ip = (Array.isArray(forwarded) ? forwarded[1] : null) || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
    if (!result || !result.ok || !result.stat) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('Error 404: Not Found\n', 'utf-8');
      log.warn(`${req.method}/${req.httpVersion}`, res.statusCode, decodeURI(req.url), ip);
    } else {
      if (result?.stat?.isFile()) {
        const ext = String(path.extname(result.file)).toLowerCase();
        const contentType = mime[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Language': 'en', 'Content-Type': contentType, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*',
        });
        if (!req.headers.range) {
          const stream = fs.createReadStream(result.file);
          stream.pipe(res); // don't compress data
          log.data(`${req.method}/${req.httpVersion}`, 'full', res.statusCode, contentType, result.stat.size, req.url, ip);
        } else {
          const range = req.headers.range.split('=')[1].split('-');
          const start = parseInt(range[0] || 0);
          const end = parseInt(range[1] || 0);
          if (end - start > 0) {
            const buffer = Buffer.alloc(end - start);
            const fd = fs.openSync(result.file, 'r');
            fs.readSync(fd, buffer, 0, end - start, start);
            fs.closeSync(fd);
            res.write(buffer);
            log.data(`${req.method}/${req.httpVersion}`, 'range', res.statusCode, contentType, start, end, end - start, req.url, ip);
          } else {
            const stream = fs.createReadStream(result.file);
            stream.pipe(res);
            log.data(`${req.method}/${req.httpVersion}`, 'full', res.statusCode, contentType, 0, 0, result.stat.size, req.url, ip);
          }
        }
      }
      if (result?.stat?.isDirectory()) {
        res.writeHead(200, { 'Content-Language': 'en', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        let dir = fs.readdirSync(result.file);
        dir = dir.map((f) => path.join(decodeURI(req.url), f));
        res.end(JSON.stringify(dir), 'utf-8');
        log.data(`${req.method}/${req.httpVersion}`, res.statusCode, 'directory/json', result.stat.size, req.url, ip);
      }
    }
  });
}

async function startStreamServer() {
  const streamServer = child.spawn('stream/stream');
  streamServer.stdout.on('data', (data) => log.data('stream:', data?.toString().replace(/[\r\n]+/gm, '')));
  streamServer.stderr.on('data', (data) => log.data('stream:', data?.toString().replace(/[\r\n]+/gm, '')));
  streamServer.on('close', (data) => log.data('stream closed:', data?.toString()));
}

// app main entry point
async function main() {
  log.header();
  process.chdir(path.join(__dirname, '..'));
  if (options.httpPort && options.httpPort > 0) {
    // @ts-ignore // ignore invalid options
    const server1 = http.createServer(options, httpRequest);
    server1.on('listening', () => log.state('http server listening:', options.httpPort));
    server1.on('error', (err) => log.error('http server:', err.message || err));
    server1.listen(options.httpPort);
  }
  if (options.httpsPort && options.httpsPort > 0) {
    // @ts-ignore // ignore invalid options
    const server2 = http2.createSecureServer(options, httpRequest);
    server2.on('listening', () => log.state('http2 server listening:', options.httpsPort));
    server2.on('error', (err) => log.error('http2 server:', err.message || err));
    server2.listen(options.httpsPort);
  }
  if (config.server.startStreamServer) startStreamServer();
}

main();
