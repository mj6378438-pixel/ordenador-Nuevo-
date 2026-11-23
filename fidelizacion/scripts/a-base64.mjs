#!/usr/bin/env node
// Convierte un archivo (certificado .pem, JSON de Google...) en una línea base64
// lista para pegar en una variable de entorno.
// Uso: npm run a-base64 -- ruta/al/archivo
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: npm run a-base64 -- ruta/al/archivo");
  process.exit(1);
}
process.stdout.write(readFileSync(file).toString("base64") + "\n");
