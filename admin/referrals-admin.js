(function () {
  "use strict";
  const tokenForm = document.getElementById("token-form");
  const tokenInput = document.getElementById("admin-token");
  const typeFilter = document.getElementById("type-filter");
  const statusFilter = document.getElementById("status-filter");
  const rows = document.getElementById("rows");
  const summary = document.getElementById("summary");
  const dialog = document.getElementById("detail-dialog");
  const facts = document.getElementById("facts");
  const editor = document.getElementById("editor");
  const saveStatus = document.getElementById("save-status");
  let token = "";
  let currentId = "";

  const labels = {
    driver_referral: "Driver", fleet_referral: "Fleet", creator_referral: "Creator",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(options.headers || {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
  }

  function filterQuery() {
    const query = new URLSearchParams();
    if (typeFilter.value) query.set("referral_type", typeFilter.value);
    if (statusFilter.value) query.set("status", statusFilter.value);
    return query;
  }

  async function load() {
    const query = filterQuery();
    summary.textContent = "Loading…";
    try {
      const result = await request(`/api/referrals?${query}`);
      summary.textContent = `${result.referrals.length} referral${result.referrals.length === 1 ? "" : "s"}`;
      rows.innerHTML = result.referrals.length ? result.referrals.map((item) => {
        const subject = item.company_name || item.referred_name || item.creator_social_link || "—";
        return `<tr data-id="${escapeHtml(item.id)}"><td>${escapeHtml(new Date(item.created_at).toLocaleDateString())}</td><td>${escapeHtml(labels[item.referral_type] || item.referral_type)}</td><td>${escapeHtml(item.referrer_name)}<br><small>${escapeHtml(item.referrer_email)}</small></td><td>${escapeHtml(subject)}</td><td>${escapeHtml(item.source_site)}</td><td><span class="badge">${escapeHtml(item.status)}</span></td><td>$${Number(item.reward_amount || 0).toFixed(2)}</td><td>${escapeHtml(item.payout_status)}</td></tr>`;
      }).join("") : '<tr><td class="empty" colspan="8">No matching referrals.</td></tr>';
    } catch (error) {
      summary.textContent = error.message;
      rows.innerHTML = '<tr><td class="empty" colspan="8">Unable to load referrals.</td></tr>';
    }
  }

  async function openDetail(id) {
    try {
      const item = await request(`/api/referrals/${encodeURIComponent(id)}`);
      currentId = id;
      const hidden = new Set(["id", "admin_notes", "status", "reward_amount", "payout_status"]);
      facts.innerHTML = Object.entries(item).filter(([key, value]) => !hidden.has(key) && value !== null && value !== "").map(([key, value]) => `<div class="fact"><span>${escapeHtml(key.replaceAll("_", " "))}</span><b>${escapeHtml(value)}</b></div>`).join("");
      editor.elements.status.value = item.status;
      editor.elements.reward_amount.value = item.reward_amount || 0;
      editor.elements.payout_status.value = item.payout_status;
      editor.elements.admin_notes.value = item.admin_notes || "";
      saveStatus.textContent = "";
      dialog.showModal();
    } catch (error) {
      summary.textContent = error.message;
    }
  }

  tokenForm.addEventListener("submit", (event) => { event.preventDefault(); token = tokenInput.value; load(); });
  typeFilter.addEventListener("change", load);
  statusFilter.addEventListener("change", load);
  document.getElementById("export-csv").addEventListener("click", async () => {
    if (!token) { summary.textContent = "Enter the admin token before exporting."; return; }
    summary.textContent = "Preparing CSV…";
    try {
      const response = await fetch(`/api/referrals.csv?${filterQuery()}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Export failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `pillowflow-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      summary.textContent = "Filtered CSV exported.";
    } catch (error) { summary.textContent = error.message; }
  });
  rows.addEventListener("click", (event) => { const row = event.target.closest("tr[data-id]"); if (row) openDetail(row.dataset.id); });
  document.getElementById("close-detail").addEventListener("click", () => dialog.close());
  editor.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveStatus.className = "status";
    saveStatus.textContent = "Saving…";
    const data = Object.fromEntries(new FormData(editor));
    data.reward_amount = Number(data.reward_amount);
    try {
      await request(`/api/referrals/${encodeURIComponent(currentId)}`, { method: "PATCH", body: JSON.stringify(data) });
      saveStatus.textContent = "Saved.";
      saveStatus.classList.add("success");
      await load();
    } catch (error) {
      saveStatus.textContent = error.message;
      saveStatus.classList.add("error");
    }
  });
})();
