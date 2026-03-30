/**
 * Cron / monitoring routes.
 *
 * GET /cron/health — checks SETTLER and REGISTRY wallet balances,
 * sends Telegram alerts when thresholds are breached, and emits a
 * status report every 12 hours.
 *
 * Call externally every 5 minutes (e.g. via cron job or uptime monitor).
 */

import { Router } from "express";
import { ethers } from "ethers";
import { CHAIN_CONFIG } from "../utils/chains.js";
import { sendTelegramAlert } from "../utils/notify.js";
import {
  SETTLER_CELO_WARNING,
  SETTLER_CELO_CRITICAL,
  SETTLER_BASE_WARNING,
  SETTLER_BASE_CRITICAL,
  REGISTRY_CELO_WARNING,
  REGISTRY_CELO_CRITICAL,
  STATUS_REPORT_INTERVAL,
} from "../utils/constants.js";

const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

// ─── Module-level state ──────────────────────────────────────────────────

let cronCycleCount = 0;

/** Dedup map: alertKey → last level sent ("warning" | "critical") */
const lastAlertState = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────

function evaluateLevel(balance, warningThreshold, criticalThreshold) {
  if (balance < criticalThreshold) return "critical";
  if (balance < warningThreshold) return "warning";
  return null;
}

function formatAlert(level, label, balance, unit, warningThreshold, criticalThreshold, address, explorerBase) {
  const emoji = level === "critical" ? "🚨" : "⚠️";
  const tag = level === "critical" ? "CRITICAL" : "WARNING";
  const action = level === "critical" ? "Action required" : "Action recommended";

  return [
    `<b>${emoji} ${tag}: ${label} Balance Low</b>`,
    "",
    `Current: ${balance} ${unit}`,
    `Critical threshold: ${criticalThreshold} ${unit}`,
    `Warning threshold: ${warningThreshold} ${unit}`,
    "",
    `Wallet: ${address}`,
    explorerBase ? `${explorerBase}/address/${address}` : "",
    "",
    `<b>${action}:</b> Send ${unit} to this wallet.`,
  ].filter(Boolean).join("\n");
}

function formatStatusReport(balances) {
  const statusLabel = (level) =>
    level === "critical" ? "🔴 CRITICAL" : level === "warning" ? "🟡 WARNING" : "🟢 OK";

  return [
    "<b>📊 HashProof Status Report</b>",
    "",
    `<b>SETTLER (Celo):</b> ${balances.settlerCelo.balance} CELO  ${statusLabel(balances.settlerCelo.level)}`,
    `<b>SETTLER (Base):</b> ${balances.settlerBase.balance} ETH  ${statusLabel(balances.settlerBase.level)}`,
    `<b>REGISTRY (Celo):</b> ${balances.registryCelo.balance} CELO  ${statusLabel(balances.registryCelo.level)}`,
    `<b>PAY_TO USDC (Celo):</b> ${balances.payToUsdc} USDC`,
    "",
    "Wallets:",
    `SETTLER: ${balances.settlerAddress}`,
    `REGISTRY: ${balances.registryAddress}`,
    `PAY_TO: ${balances.payToAddress}`,
  ].join("\n");
}

// ─── Router factory ──────────────────────────────────────────────────────

export function createCronRouter() {
  const router = Router();

  // Derive addresses once
  const settlerAddress = new ethers.Wallet(process.env.SETTLER_PRIVATE_KEY).address;
  const registryAddress = new ethers.Wallet(process.env.REGISTRY_PRIVATE_KEY).address;
  const payToAddress = process.env.PAY_TO;

  router.get("/health", async (_req, res) => {
    try {
      const celoProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.celo.getRpcUrl());
      const baseProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.base.getRpcUrl());

      // Step 1: Fetch native balances in parallel
      const [settlerCeloRaw, settlerBaseRaw, registryCeloRaw] = await Promise.all([
        celoProvider.getBalance(settlerAddress),
        baseProvider.getBalance(settlerAddress),
        celoProvider.getBalance(registryAddress),
      ]);

      const settlerCelo = parseFloat(ethers.formatEther(settlerCeloRaw));
      const settlerBase = parseFloat(ethers.formatEther(settlerBaseRaw));
      const registryCelo = parseFloat(ethers.formatEther(registryCeloRaw));

      // Step 2: Evaluate thresholds
      const checks = [
        {
          key: "settler_celo",
          label: "SETTLER (Celo)",
          balance: settlerCelo,
          unit: "CELO",
          warn: SETTLER_CELO_WARNING,
          crit: SETTLER_CELO_CRITICAL,
          address: settlerAddress,
          explorer: "https://celoscan.io",
        },
        {
          key: "settler_base",
          label: "SETTLER (Base)",
          balance: settlerBase,
          unit: "ETH",
          warn: SETTLER_BASE_WARNING,
          crit: SETTLER_BASE_CRITICAL,
          address: settlerAddress,
          explorer: "https://basescan.org",
        },
        {
          key: "registry_celo",
          label: "REGISTRY (Celo)",
          balance: registryCelo,
          unit: "CELO",
          warn: REGISTRY_CELO_WARNING,
          crit: REGISTRY_CELO_CRITICAL,
          address: registryAddress,
          explorer: "https://celoscan.io",
        },
      ];

      // Step 3: Build alerts with dedup
      const alerts = [];
      for (const c of checks) {
        const level = evaluateLevel(c.balance, c.warn, c.crit);
        const prev = lastAlertState.get(c.key);

        if (!level) {
          // Recovered — clear state
          lastAlertState.delete(c.key);
        } else if (level !== prev) {
          // New or escalated alert
          alerts.push({
            key: c.key,
            level,
            msg: formatAlert(level, c.label, c.balance, c.unit, c.warn, c.crit, c.address, c.explorer),
          });
          lastAlertState.set(c.key, level);
        }
        // else: same level as last time → skip (dedup)
      }

      // Step 4: Send alerts (critical first)
      alerts.sort((a, b) => (a.level === "critical" ? -1 : 1) - (b.level === "critical" ? -1 : 1));
      for (const a of alerts) {
        await sendTelegramAlert(a.key, a.msg);
      }

      // Step 5: Status report every N cycles
      cronCycleCount += 1;
      let statusSent = false;
      if (process.env.CRON_STATUS_REPORT === "true" && cronCycleCount >= STATUS_REPORT_INTERVAL) {
        cronCycleCount = 0;

        // Fetch PAY_TO USDC balance on Celo
        const usdc = new ethers.Contract(CHAIN_CONFIG.celo.usdcAddress, ERC20_BALANCE_ABI, celoProvider);
        const payToRaw = await usdc.balanceOf(payToAddress);
        const payToUsdc = parseFloat(ethers.formatUnits(payToRaw, 6)).toFixed(2);

        const report = formatStatusReport({
          settlerCelo: { balance: settlerCelo.toFixed(4), level: evaluateLevel(settlerCelo, SETTLER_CELO_WARNING, SETTLER_CELO_CRITICAL) },
          settlerBase: { balance: settlerBase.toFixed(6), level: evaluateLevel(settlerBase, SETTLER_BASE_WARNING, SETTLER_BASE_CRITICAL) },
          registryCelo: { balance: registryCelo.toFixed(4), level: evaluateLevel(registryCelo, REGISTRY_CELO_WARNING, REGISTRY_CELO_CRITICAL) },
          payToUsdc,
          settlerAddress,
          registryAddress,
          payToAddress,
        });

        await sendTelegramAlert("status_report", report);
        statusSent = true;
      }

      // Step 6: JSON response
      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        settler: {
          address: settlerAddress,
          celo: { balance: settlerCelo, healthy: settlerCelo >= SETTLER_CELO_WARNING },
          base: { balance: settlerBase, healthy: settlerBase >= SETTLER_BASE_WARNING },
        },
        registry: {
          address: registryAddress,
          celo: { balance: registryCelo, healthy: registryCelo >= REGISTRY_CELO_WARNING },
        },
        alerts_sent: alerts.length,
        status_report_sent: statusSent,
        cycle: cronCycleCount,
      });
    } catch (err) {
      console.error("[cron/health]", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Test endpoint: simulate all alert types with real balances ────────
  router.get("/test-alerts", async (_req, res) => {
    try {
      const celoProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.celo.getRpcUrl());
      const baseProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.base.getRpcUrl());

      const [settlerCeloRaw, settlerBaseRaw, registryCeloRaw] = await Promise.all([
        celoProvider.getBalance(settlerAddress),
        baseProvider.getBalance(settlerAddress),
        celoProvider.getBalance(registryAddress),
      ]);

      const settlerCelo = parseFloat(ethers.formatEther(settlerCeloRaw));
      const settlerBase = parseFloat(ethers.formatEther(settlerBaseRaw));
      const registryCelo = parseFloat(ethers.formatEther(registryCeloRaw));

      const usdc = new ethers.Contract(CHAIN_CONFIG.celo.usdcAddress, ERC20_BALANCE_ABI, celoProvider);
      const payToRaw = await usdc.balanceOf(payToAddress);
      const payToUsdc = parseFloat(ethers.formatUnits(payToRaw, 6)).toFixed(2);

      const messages = [
        { key: "warning", msg: formatAlert("warning", "SETTLER (Celo)", settlerCelo.toFixed(4), "CELO", SETTLER_CELO_WARNING, SETTLER_CELO_CRITICAL, settlerAddress, "https://celoscan.io") },
        { key: "critical", msg: formatAlert("critical", "SETTLER (Base)", settlerBase.toFixed(6), "ETH", SETTLER_BASE_WARNING, SETTLER_BASE_CRITICAL, settlerAddress, "https://basescan.org") },
        { key: "critical_reg", msg: formatAlert("critical", "REGISTRY (Celo)", registryCelo.toFixed(4), "CELO", REGISTRY_CELO_WARNING, REGISTRY_CELO_CRITICAL, registryAddress, "https://celoscan.io") },
        {
          key: "status_report",
          msg: formatStatusReport({
            settlerCelo: { balance: settlerCelo.toFixed(4), level: evaluateLevel(settlerCelo, SETTLER_CELO_WARNING, SETTLER_CELO_CRITICAL) },
            settlerBase: { balance: settlerBase.toFixed(6), level: evaluateLevel(settlerBase, SETTLER_BASE_WARNING, SETTLER_BASE_CRITICAL) },
            registryCelo: { balance: registryCelo.toFixed(4), level: evaluateLevel(registryCelo, REGISTRY_CELO_WARNING, REGISTRY_CELO_CRITICAL) },
            payToUsdc,
            settlerAddress,
            registryAddress,
            payToAddress,
          }),
        },
      ];

      const results = [];
      for (const m of messages) {
        const sent = await sendTelegramAlert(m.key, m.msg);
        results.push({ key: m.key, sent });
      }

      res.json({ ok: true, results });
    } catch (err) {
      console.error("[cron/test-alerts]", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}
