(function () {
  "use strict";

  const PATHS = {
    driver_referral: {
      label: "A driver / friend",
      fields: [
        ["referred_name", "Referred driver name", "text", true],
        ["referred_contact", "Referred driver email or phone", "text", true],
      ],
    },
    fleet_referral: {
      label: "A company / fleet",
      fields: [
        ["company_name", "Company name", "text", true],
        ["company_website", "Company website", "url", true],
        ["fleet_size", "Fleet size", "text", true],
        ["decision_maker_name", "Decision-maker name", "text", true],
        ["decision_maker_contact", "Decision-maker email or phone", "text", true],
        ["reason", "Why they may need PillowFlow", "textarea", true],
      ],
    },
    creator_referral: {
      label: "I am a creator / blogger",
      fields: [
        ["creator_social_link", "Social link / website", "url", true],
        ["creator_audience_type", "Audience type", "text", true],
        ["creator_audience_size", "Estimated audience size", "text", true],
        ["reason", "Why you want to test PillowFlow", "textarea", true],
      ],
    },
  };

  const SPANISH = {
    "A driver / friend": "Un conductor / amigo",
    "A company / fleet": "Una empresa / flota",
    "I am a creator / blogger": "Soy creador / bloguero",
    "Referred driver name": "Nombre del conductor referido",
    "Referred driver email or phone": "Correo o teléfono del conductor referido",
    "Company name": "Nombre de la empresa",
    "Company website": "Sitio web de la empresa",
    "Fleet size": "Tamaño de la flota",
    "Decision-maker name": "Nombre de la persona responsable",
    "Decision-maker email or phone": "Correo o teléfono de la persona responsable",
    "Why they may need PillowFlow": "Por qué podrían necesitar PillowFlow",
    "Social link / website": "Enlace social / sitio web",
    "Audience type": "Tipo de audiencia",
    "Estimated audience size": "Tamaño estimado de la audiencia",
    "Why you want to test PillowFlow": "Por qué desea probar PillowFlow",
    "One program for driver, fleet, and creator referrals.": "Un programa para referidos de conductores, flotas y creadores.",
    "Who do you want to refer?": "¿A quién desea referir?",
    "Your name": "Su nombre",
    "Your email": "Su correo electrónico",
    "Your phone": "Su teléfono",
    "Leave this field blank": "Deje este campo en blanco",
    "I confirm this submission is genuine and I will not use self-referrals, spam, false information, or medical claims.": "Confirmo que esta solicitud es auténtica y que no usaré autorreferidos, spam, información falsa ni afirmaciones médicas.",
    "This program is manually reviewed. Rewards are paid only after referrals are verified and qualifying actions are completed.": "Este programa se revisa manualmente. Las recompensas se pagan únicamente después de verificar los referidos y completar las acciones requeridas.",
    "Submit Referral": "Enviar referido",
    "Creator name": "Nombre del creador",
    "Referrer name": "Nombre de quien refiere",
    "Choose who you want to refer.": "Elija a quién desea referir.",
    "Submitting…": "Enviando…",
    "Submission failed.": "No se pudo enviar.",
    "Referral submitted for review. Thank you.": "El referido fue enviado para revisión. Gracias.",
    "Could not submit. Please try again.": "No se pudo enviar. Inténtelo de nuevo."
  };

  const styles = `
    :host{display:block;color:#182033;font:16px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}.card{padding:30px;border-radius:18px;background:#fff;box-shadow:0 18px 55px rgba(23,36,63,.12)}
    h3{margin:0 0 6px;color:#182033;font-size:23px;letter-spacing:-.025em}.intro{margin:0 0 24px;color:#657086;font-size:14px}
    .field{display:grid;gap:6px}.field label,.path-label{color:#182033;font-size:13px;font-weight:750}.grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.full{grid-column:1/-1}
    input,select,textarea{width:100%;padding:12px 13px;border:1px solid #cfd5de;border-radius:9px;background:#fff;color:#182033;font:inherit}
    textarea{min-height:108px;resize:vertical}input:focus,select:focus,textarea:focus{outline:3px solid rgba(199,81,35,.16);border-color:#c75123}
    .path-options{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:7px 0 21px}.path{position:relative}.path input{position:absolute;opacity:0;pointer-events:none}.path span{display:flex;align-items:center;justify-content:center;height:100%;min-height:54px;padding:9px;border:1px solid #cfd5de;border-radius:10px;text-align:center;color:#4f5c71;font-size:13px;font-weight:700;cursor:pointer}.path input:checked+span{border-color:#c75123;background:#fbede6;color:#9e3815;box-shadow:0 0 0 2px rgba(199,81,35,.12)}
    .dynamic{display:contents}.hp{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.terms{display:flex;align-items:flex-start;gap:9px;color:#657086;font-size:12px}.terms input{width:auto;margin-top:4px}.review{margin:19px 0 0;padding:13px 15px;border-radius:9px;background:#f5f2ec;color:#596579;font-size:12px}
    .actions{display:flex;align-items:center;gap:14px;margin-top:19px}button{min-height:49px;padding:12px 20px;border:0;border-radius:999px;background:#c75123;color:#fff;font:inherit;font-weight:800;cursor:pointer}button:hover{background:#9e3815}button:disabled{opacity:.65;cursor:wait}.status{margin:0;color:#657086;font-size:12px}.status.error{color:#a32727}.status.success{color:#176b52;font-weight:700}
    @media(max-width:620px){.card{padding:21px}.grid,.path-options{grid-template-columns:1fr}.full{grid-column:auto}.path span{min-height:46px}.actions{align-items:stretch;flex-direction:column}button{width:100%}}
  `;

  class PillowFlowReferralForm extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      this.attachShadow({ mode: "open" });
      this.render();
      this.languageObserver = new MutationObserver(() => this.render());
      this.languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }

    disconnectedCallback() {
      if (this.languageObserver) this.languageObserver.disconnect();
    }

    translate(text) {
      return document.documentElement.lang.toLowerCase().startsWith("es") ? (SPANISH[text] || text) : text;
    }

    render() {
      const values = this.form ? Object.fromEntries(new FormData(this.form)) : {};
      const t = (text) => this.translate(text);
      this.shadowRoot.innerHTML = `<style>${styles}</style><form class="card" novalidate>
        <h3>PillowFlow Founding Drivers</h3>
        <p class="intro">${t("One program for driver, fleet, and creator referrals.")}</p>
        <div class="path-label" id="path-label">${t("Who do you want to refer?")}</div>
        <div class="path-options" role="radiogroup" aria-labelledby="path-label">
          ${Object.entries(PATHS).map(([value, path]) => `<label class="path"><input type="radio" name="referral_type" value="${value}"><span>${t(path.label)}</span></label>`).join("")}
        </div>
        <div class="grid">
          <div class="field"><label for="referrer-name">${t("Your name")}</label><input id="referrer-name" name="referrer_name" autocomplete="name" required></div>
          <div class="field"><label for="referrer-email">${t("Your email")}</label><input id="referrer-email" name="referrer_email" type="email" autocomplete="email" required></div>
          <div class="field full"><label for="referrer-phone">${t("Your phone")}</label><input id="referrer-phone" name="referrer_phone" type="tel" autocomplete="tel" required></div>
          <div class="dynamic"></div>
          <div class="hp" aria-hidden="true"><label for="pf-website">${t("Leave this field blank")}</label><input id="pf-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
          <label class="terms full"><input type="checkbox" name="terms_confirmed" required><span>${t("I confirm this submission is genuine and I will not use self-referrals, spam, false information, or medical claims.")}</span></label>
        </div>
        <p class="review">${t("This program is manually reviewed. Rewards are paid only after referrals are verified and qualifying actions are completed.")}</p>
        <div class="actions"><button type="submit">${t("Submit Referral")}</button><p class="status" role="status" aria-live="polite"></p></div>
      </form>`;
      this.form = this.shadowRoot.querySelector("form");
      this.dynamic = this.shadowRoot.querySelector(".dynamic");
      this.status = this.shadowRoot.querySelector(".status");
      this.form.addEventListener("change", (event) => {
        if (event.target.name === "referral_type") this.renderFields(event.target.value);
      });
      this.form.addEventListener("submit", (event) => this.submit(event));
      const initial = values.referral_type || this.getAttribute("default-type");
      if (PATHS[initial]) {
        this.form.elements.referral_type.value = initial;
        this.renderFields(initial);
      }
      Array.from(this.form.elements).forEach((control) => {
        if (!control.name || !Object.prototype.hasOwnProperty.call(values, control.name)) return;
        if (control.type === "radio") control.checked = control.value === values[control.name];
        else if (control.type === "checkbox") control.checked = true;
        else control.value = values[control.name];
      });
    }

    renderFields(type) {
      this.shadowRoot.querySelector('label[for="referrer-name"]').textContent = this.translate(type === "creator_referral" ? "Creator name" : "Referrer name");
      this.dynamic.innerHTML = PATHS[type].fields.map(([name, label, inputType, required]) => {
        const id = `pf-${name}`;
        const control = inputType === "textarea"
          ? `<textarea id="${id}" name="${name}" ${required ? "required" : ""}></textarea>`
          : `<input id="${id}" name="${name}" type="${inputType}" ${required ? "required" : ""}>`;
        return `<div class="field full"><label for="${id}">${this.translate(label)}</label>${control}</div>`;
      }).join("");
    }

    async submit(event) {
      event.preventDefault();
      this.status.className = "status";
      if (!this.form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(this.form));
      if (!data.referral_type) {
        this.status.textContent = this.translate("Choose who you want to refer.");
        this.status.classList.add("error");
        return;
      }
      if (data.referral_type === "driver_referral") {
        const contact = data.referred_contact || "";
        if (contact.includes("@")) data.referred_email = contact;
        else data.referred_phone = contact;
        delete data.referred_contact;
      }
      data.source_site = this.getAttribute("source-site") || window.location.hostname;
      const button = this.form.querySelector("button");
      button.disabled = true;
      this.status.textContent = this.translate("Submitting…");
      try {
        const base = (this.getAttribute("api-base") || "").replace(/\/$/, "");
        const response = await fetch(`${base}/api/referrals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || this.translate("Submission failed."));
        this.form.reset();
        this.dynamic.innerHTML = "";
        this.status.textContent = this.translate("Referral submitted for review. Thank you.");
        this.status.classList.add("success");
        this.dispatchEvent(new CustomEvent("referral-submitted", { detail: result }));
      } catch (error) {
        this.status.textContent = error.message || this.translate("Could not submit. Please try again.");
        this.status.classList.add("error");
      } finally {
        button.disabled = false;
      }
    }
  }

  if (!customElements.get("pillowflow-referral-form")) {
    customElements.define("pillowflow-referral-form", PillowFlowReferralForm);
  }
})();
