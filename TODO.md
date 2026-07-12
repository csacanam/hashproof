# TODO — crecimiento y distribución para agentes

Contexto: HashProof es el proyecto más agent-ready del portafolio (emisión 100% autónoma vía x402, skill.md completo) y la apuesta comercial principal. Estado al 12 jul 2026. Hecho ya: ✅ skill instalable (`npx skills add csacanam/hashproof`), ✅ llms.txt, ✅ metadata.json en formato ERC-8004 registration-v1 completo, ✅ x402 verificado en producción aceptando USDC en Base Y Celo.

## Prioridad 1

- [ ] **Registro ERC-8004 on-chain** — es la mejora de mayor retorno/esfuerzo: el metadata.json existe pero ningún explorador lo indexa. Runbook completo en `docs/ERC8004-REGISTRATION.md`. Falta decidir la wallet dueña de la identidad (sugerida: payTo `0x0a25C912…3f0d`). Después de registrar: agregar `registrations` al metadata + crear `.well-known/agent-registration.json` + redeploy.
- [ ] **Demo en X** con output real: "Claude emitió este diploma verificable on-chain en 2 prompts" — PDF con QR real + `npx skills add csacanam/hashproof` en el post. El demo es 10× mejor con plantilla propia → depende del punto siguiente.

## Plantillas propias para agentes (diagnóstico 12 jul 2026)

El bloqueo real del flujo "certificados con mi marca vía agente" NO es hostear la imagen (eso se resuelve en 30s con cualquier URL) sino el **ciclo de diseño de posiciones**: el preview con `:ref` exige template existente en DB, los templates solo se crean dentro de una emisión pagada, y son create-only (no editables) → iterar un diseño = quemar slugs y emisiones de $0.10.

- [x] **`POST /template-previews` (stateless)**: preview desde template INLINE — sin DB, sin pago, mismas reglas de render, QR placeholder y watermark. 3 tests, suite verde. Aditivo. **Deployado y verificado en producción el 12 jul** (DigitalOcean auto-deploy; rutas existentes intactas durante el rollout).
- [x] Skill.md (web + `skills/`) actualizado con el loop visual: el agente itera posiciones con /template-previews e inspecciona el PDF si tiene visión; aprobación humana solo al final.
- [x] Guía de fondos en el skill (12 jul): división de trabajo clara — el fondo/marca lo hace el humano o su agente (Canva o generación de imágenes con prompt incluido); HashProof da la spec (estático horneado en la imagen, campos solo para lo variable, esquina QR libre, 3508×2480).
- [ ] Presets de layout (3-4 diseños calculados según dimensiones de la imagen) para que el 80% de los casos no necesite iterar — también sirve a agentes sin visión.
- [ ] Galería de fondos default hosteados por HashProof (3-5 profesionales) — elimina la ruta "no tengo diseño" como fricción.
- [ ] Nice-to-have (ya no prioritario): endpoint de upload de fondos a Pinata (`POST /backgrounds`).

## Comercial (vender a humanos mientras la economía de agentes madura)

- [ ] Caso de estudio Peewah (N credenciales/mes vía API) como material de venta.
- [ ] Outreach a 3–5 organizaciones similares (bootcamps, certificadoras, comunidades que emiten diplomas/badges).

## Distribución

- [ ] Listar en índices x402 (x402scan, awesome-x402) y PR a awesome-erc8004.
- [ ] Evaluar migrar el settle del EOA propio (`backend/src/services/settleEOA.js`) al facilitator de Coinbase CDP → entra al Bazaar de CDP de paso.
- [ ] Considerar un MCP server con tool `issue_credential` (distribución dentro de Claude/Cursor de miles de devs).

## Mantenimiento

- [ ] El skill está duplicado: `skills/hashproof/SKILL.md` (instalable) ↔ `frontend/public/skill.md` (web). Al editar uno, copiar al otro (o automatizar en el build).
- [ ] `docs/WORK-PLAN.md:34` menciona explorar alinear `CredentialRegistry` con ERC-8004 — decidir si aplica.
