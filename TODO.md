# TODO — crecimiento y distribución para agentes

Contexto: HashProof es el proyecto más agent-ready del portafolio (emisión 100% autónoma vía x402, skill.md completo) y la apuesta comercial principal. Estado al 12 jul 2026. Hecho ya: ✅ skill instalable (`npx skills add csacanam/hashproof`), ✅ llms.txt, ✅ metadata.json en formato ERC-8004 registration-v1 completo, ✅ x402 verificado en producción aceptando USDC en Base Y Celo.

## Prioridad 1

- [x] **Registro ERC-8004 HECHO (12 jul)**: agente **#9669** en Celo, owner = wallet settler del proyecto `0x2170bc5E…2ab6` (tx `0x5b898a38…132b`). Verificación circular cerrada: `registrations` en metadata.json + `.well-known/agent-registration.json`. Perfil: https://www.8004scan.io/agents/celo/9669
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

- [x] PRs abiertos (12 jul): awesome-agentic-commerce#442 + awesome-erc8004#80 + awesome-mcp-servers#9909 + awesome-celo#1. Pendiente aparte: x402scan/índices automáticos.
- [ ] Evaluar migrar el settle del EOA propio (`backend/src/services/settleEOA.js`) al facilitator de Coinbase CDP → entra al Bazaar de CDP de paso.
- [x] MCP server construido y probado (12 jul): `mcp/` con 4 tools (get_template_requirements, preview_template, issue_credential, verify_credential), pago por API key o x402 (Base/Celo), smoke test del protocolo completo contra producción. Instalable con `claude mcp add hashproof -- npx -y hashproof-mcp` una vez publicado.
- [x] `hashproof-mcp@0.1.0` PUBLICADO en npm (12 jul) — cold-install verificado: `npx -y hashproof-mcp` hace handshake MCP y expone los 4 tools. Instalación: `claude mcp add hashproof -- npx -y hashproof-mcp`.
- [x] **Registro MCP oficial: PUBLICADO** (12 jul) — `io.github.csacanam/hashproof` v0.1.1 verificado en la API pública del registro. Los directorios (Smithery, Glama, PulseMCP, mcp.so) lo crawlean de ahí.
- [ ] Reclamar el listing en Smithery/Glama cuando aparezca + PR a punkpeye/awesome-mcp-servers (refuerzo de training data).

## Mantenimiento

- [ ] El skill está duplicado: `skills/hashproof/SKILL.md` (instalable) ↔ `frontend/public/skill.md` (web). Al editar uno, copiar al otro (o automatizar en el build).
- [ ] `docs/WORK-PLAN.md:34` menciona explorar alinear `CredentialRegistry` con ERC-8004 — decidir si aplica.
