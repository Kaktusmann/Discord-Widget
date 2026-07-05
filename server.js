// Plain Next.js custom server, used unmodified by both Docker's CMD and Plesk's
// Passenger "Application Startup File" — avoids maintaining two entrypoints.
// Listens on process.env.PORT exactly as both hosting targets expect.
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Ready on :${port}`);
  });
});
