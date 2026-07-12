# TODO — crecimiento y distribución para agentes

Contexto: HashProof es el proyecto más agent-ready del portafolio (emisión 100% autónoma vía x402, skill.md completo) y la apuesta comercial principal. Estado al 12 jul 2026. Hecho ya: ✅ skill instalable (`npx skills add csacanam/hashproof`), ✅ llms.txt, ✅ metadata.json en formato ERC-8004 registration-v1 completo, ✅ x402 verificado en producción aceptando USDC en Base Y Celo.

## Prioridad 1

- [ ] **Registro ERC-8004 on-chain** — es la mejora de mayor retorno/esfuerzo: el metadata.json existe pero ningún explorador lo indexa. Runbook completo en `docs/ERC8004-REGISTRATION.md`. Falta decidir la wallet dueña de la identidad (sugerida: payTo `0x0a25C912…3f0d`). Después de registrar: agregar `registrations` al metadata + crear `.well-known/agent-registration.json` + redeploy.
- [ ] **Demo en X** con output real: "Claude emitió este diploma verificable on-chain en 2 prompts" — PDF con QR real + `npx skills add csacanam/hashproof` en el post.

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
