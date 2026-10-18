const $ = (id) => document.getElementById(id);
const btn = $("analyzeBtn");

function setStatus(message, kind = "") {
  const el = $("status");
  el.textContent = message;
  el.className = "status" + (kind ? " " + kind : "");
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 5 }) : String(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function renderConfirmations(items) {
  const icons = {
    confirmed: "✓", candidate: "◉", not_confirmed: "○",
    unavailable: "!", warning: "!", context_only: "i"
  };
  $("confirmations").innerHTML = (items || []).map(item => `
    <div class="confirmation">
      <div class="confirm-icon state-${escapeHtml(item.status)}">${icons[item.status] || "•"}</div>
      <div>
        <strong>${escapeHtml(item.name)} <span class="state-${escapeHtml(item.status)}">· ${escapeHtml(item.status.replaceAll("_", " "))}</span></strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    </div>`).join("");
}

function renderTimeframes(frames) {
  const order = ["D1", "H4", "H1", "M15", "M5"];
  $("timeframes").innerHTML = order.map(key => {
    const t = frames[key];
    if (!t) return "";
    const fvg = (t.fvgs || []).map(x => `${x.type} ${x.low}–${x.high}`).join("; ") || "No recent FVG detected";
    const ote = t.ote ? `${t.ote.bias}: ${t.ote.oteLow}–${t.ote.oteHigh}` : "No clear OTE zone";
    return `<article class="tf-card">
      <h4>${key} <span style="float:right;color:var(--muted);font-size:10px">${fmt(t.lastClose)}</span></h4>
      <p><b>Structure:</b> ${escapeHtml(t.structure)}</p>
      <p><b>BOS:</b> ${escapeHtml(t.bos)}</p>
      <p><b>Liquidity:</b> ${escapeHtml(t.liquiditySweep)}</p>
      <p><b>ATR(14):</b> ${fmt(t.atr14)} · <b>RSI:</b> ${fmt(t.rsi14)}</p>
      <p><b>FVG:</b> ${escapeHtml(fvg)}</p>
      <p><b>OTE:</b> ${escapeHtml(ote)}</p>
      <p><b>VWAP:</b> ${escapeHtml(t.vwap?.status === "Unavailable" ? "Unavailable" : fmt(t.vwap?.value))}</p>
      <p><b>Volume Profile:</b> ${escapeHtml(t.volumeProfile?.status === "Unavailable" ? "Unavailable" : fmt(t.volumeProfile?.poc))}</p>
    </article>`;
  }).join("");
}

function renderResult(data) {
  $("result").classList.remove("hidden");
  $("resultSymbol").textContent = data.symbol;
  $("signalLabel").textContent = data.signal;
  const card = $("result").querySelector(".signal-card");
  card.classList.remove("signal-buy", "signal-sell", "signal-wait");
  card.classList.add(data.signal === "BUY" ? "signal-buy" : data.signal === "SELL" ? "signal-sell" : "signal-wait");
  $("scoreValue").textContent = `${fmt(data.confidenceScore)}/100`;
  $("rationale").textContent = data.rationale || "";
  $("entry").textContent = fmt(data.entry);
  $("sl").textContent = fmt(data.stopLoss);
  $("tp1").textContent = fmt(data.takeProfits?.[0]);
  $("tp2").textContent = fmt(data.takeProfits?.[1]);
  $("tp3").textContent = fmt(data.takeProfits?.[2]);
  $("rr").textContent = data.riskReward ? `1:${fmt(data.riskReward)}` : "—";
  $("scoreNote").textContent = data.confidenceNote || "";
  renderConfirmations(data.confirmationDetails);
  renderTimeframes(data.timeframes || {});
  $("dataSource").textContent = `Source: ${data.dataSource || "Unknown"} · Generated: ${new Date(data.generatedAt).toLocaleString()}`;
  $("dataNote").textContent = data.dataNote || "";
  $("disclaimer").textContent = data.disclaimer || "";
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "ANALYZING…";
  $("result").classList.add("hidden");
  setStatus("Fetching live candles for D1, H4, H1, M15 and M5. Please wait…");
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: $("symbol").value })
    });
    const data = await response.json();
    if (!response.ok) {
      const parts = [data.error, data.help, data.note].filter(Boolean);
      if (Array.isArray(data.dataIssues)) parts.push(data.dataIssues.map(x => `${x.timeframe}: ${x.reason}`).join(" | "));
      throw new Error(parts.join(" "));
    }
    renderResult(data);
    setStatus(`Analysis completed for ${data.symbol}. Check each confirmation and verify prices in your broker platform.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not complete analysis. Check API setup and data access.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "ANALYZE MARKET";
  }
});