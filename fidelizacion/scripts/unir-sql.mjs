#!/usr/bin/env node
// Junta todas las migraciones en supabase/INSTALAR-TODO.sql para pegarlas de una vez
// en el SQL Editor de Supabase (solo en un proyecto NUEVO y vacío).
// Uso: npm run unir-sql
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const header = `-- ════════════════════════════════════════════════════════════════════
--  INSTALACIÓN COMPLETA DE LA BASE DE DATOS
--  Para un proyecto de Supabase NUEVO y vacío. Pega TODO en
--  SQL Editor → New query → Run. Solo se ejecuta una vez.
--  (Archivo generado con "npm run unir-sql": no lo edites a mano.)
--  Incluye: ${files.join(", ")}
-- ════════════════════════════════════════════════════════════════════
`;
const body = files.map((f) => `\n\n-- ▼▼▼ ${f} ▼▼▼\n\n` + readFileSync(`${dir}/${f}`, "utf8")).join("");
writeFileSync("supabase/INSTALAR-TODO.sql", header + body);
console.log(`supabase/INSTALAR-TODO.sql generado con ${files.length} migraciones.`);
