const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "3000");
const useTls = process.env.USE_TLS === "1";
const certPath = process.env.CERT_FILE ?? "./certs/dev-cert.pem";
const keyPath = process.env.KEY_FILE ?? "./certs/dev-key.pem";

let tls;
if (useTls) {
  const certFile = Bun.file(certPath);
  const keyFile = Bun.file(keyPath);

  if (!(await certFile.exists()) || !(await keyFile.exists())) {
    throw new Error(
      `Missing TLS files. Set CERT_FILE and KEY_FILE, or place certs at ${certPath} and ${keyPath}.`,
    );
  }

  tls = {
    cert: certFile,
    key: keyFile,
  };
}

const build = await Bun.build({
  entrypoints: ["./demo/main.ts"],
  target: "browser",
  format: "esm",
  sourcemap: "inline",
  minify: false,
});

if (!build.success) {
  for (const log of build.logs) {
    console.error(log);
  }
  throw new Error("Failed to build browser bundle.");
}

const appBundle = build.outputs[0];
if (!appBundle) {
  throw new Error("No browser bundle was produced.");
}

const indexFile = Bun.file("./demo/index.html");

const server = Bun.serve({
  hostname: host,
  port,
  tls,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(indexFile, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/app.js") {
      return new Response(appBundle, {
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

const protocol = useTls ? "https" : "http";
console.log(`${protocol.toUpperCase()} demo ready at ${protocol}://${host}:${server.port}/`);
