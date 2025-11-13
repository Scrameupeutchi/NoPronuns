/**
 * @name NoPronuns
 * @description Hide pronouns from the Discord UI.
 * @version 1.0.0
 * @author Scrameupeutchi
 * @authorId 0
 * @source https://github.com/Scrameupeutchi/NoPronuns
 * @updateUrl https://github.com/Scrameupeutchi/NoPronuns/NoPronuns.plugin.js
 * @invite 0
 */


const NOPRONUNS_PLUGIN_NAME = "NoPronuns";

module.exports = class NoPronuns {
  constructor() {
    this.observer = null;
    this.styleId = NOPRONUNS_PLUGIN_NAME;
    this.markerAttr = "data-nopronuns-hidden";
    this.defaultConfig = {
      cssOnly: true,
      aggressive: true,
      extraSelectors: []
    };
    this.config = this._loadConfig();
  }

  getName() { return NOPRONUNS_PLUGIN_NAME; }
  getDescription() { return "Hide pronouns from the Discord UI."; }
  getVersion() { return "1.0.0"; }
  getAuthor() { return "Scrameupeutchi"; }

  start() {
    try {
      this._applyStyles();
      this._observe();
      this._sweep(document.body);
    } catch (e) {
      try { BdApi.UI.showToast(`${NOPRONUNS_PLUGIN_NAME}: Damn, the plugin couldn't start`, {type: "danger"}); } catch (_) {}
      console.error(`[${NOPRONUNS_PLUGIN_NAME}] Encountered the following issue : `, e);
    }
  }

  stop() {
    try {
      this._disconnect();
      this._removeStyles();
      this._revertInlineHides();
    } catch (e) {
      console.error(`[${NOPRONUNS_PLUGIN_NAME}] Encountered the following issue : `, e);
    }
  }

  _loadConfig() {
    try {
      const saved = BdApi.Data.load(NOPRONUNS_PLUGIN_NAME, "config") || {};
      return Object.assign({}, this.defaultConfig, saved);
    } catch (_) {
      return Object.assign({}, this.defaultConfig);
    }
  }

  _saveConfig() {
    try { BdApi.Data.save(NOPRONUNS_PLUGIN_NAME, "config", this.config); } catch (_) {}
  }

  getSettingsPanel() {
    if (!BdApi?.UI?.buildSettingsPanel) {
      const fallback = document.createElement("div");
      fallback.style.padding = "8px";
      fallback.textContent = "NoPronuns: BetterDiscord UI builder not available. Please update BetterDiscord.";
      return fallback;
    }

    try {
      const panel = BdApi.UI.buildSettingsPanel({
        settings: [{
          type: "switch",
          id: "aggressive",
          name: "Aggressive mode",
          note: "Also hide sections titled 'Pronouns' in popouts/profiles by scanning headings.",
          value: !!this.config.aggressive,
          onChange: (value) => {
            this.config.aggressive = !!value;
            this._saveConfig();
            if (this.config.aggressive) this._sweep(document.body);
            else this._revertInlineHides();
          }
  }],
        onChange: () => this._saveConfig()
      });

      const element = panel?.getElement?.() ?? panel;
      if (element instanceof HTMLElement) {
        element.appendChild(this._buildExtraSelectorsSetting());
      }

      return panel?.getElement ? panel : element;
    } catch (e) {
      console.error(`[${NOPRONUNS_PLUGIN_NAME}] settings panel error`, e);
      const fallback = document.createElement("div");
      fallback.style.padding = "8px";
      fallback.textContent = "NoPronuns: Failed to build settings panel. Check console.";
      return fallback;
    }
  }

  _buildExtraSelectorsSetting() {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "8px";
    wrapper.style.marginTop = "16px";

    const label = document.createElement("div");
    label.style.fontWeight = "600";
    label.style.fontSize = "14px";
    label.textContent = "Extra CSS selectors";

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = "0.7";
    note.textContent = "One per line. Each will be hidden via CSS.";

    const textarea = document.createElement("textarea");
    textarea.value = (this.config.extraSelectors || []).join("\n");
    textarea.rows = 5;
    textarea.style.width = "100%";
    textarea.style.resize = "vertical";
    textarea.style.background = "var(--background-tertiary)";
    textarea.style.border = "1px solid var(--background-floating, rgba(79,84,92,0.48))";
    textarea.style.borderRadius = "4px";
    textarea.style.padding = "8px";
    textarea.style.color = "var(--text-normal)";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";

    const applyBtn = document.createElement("button");
    applyBtn.textContent = "Apply";
    applyBtn.style.padding = "6px 12px";
    applyBtn.style.borderRadius = "4px";
    applyBtn.style.border = "none";
    applyBtn.style.cursor = "pointer";
    applyBtn.style.background = "var(--brand-experiment)";
    applyBtn.style.color = "#fff";

    applyBtn.addEventListener("click", () => {
      const lines = textarea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      this.config.extraSelectors = lines;
      this._saveConfig();
      this._removeStyles();
      this._applyStyles();
      try { BdApi.UI.showToast("NoPronuns: selectors applied", { type: "success" }); } catch (_) {}
    });

    controls.appendChild(applyBtn);

    wrapper.appendChild(label);
    wrapper.appendChild(note);
    wrapper.appendChild(textarea);
    wrapper.appendChild(controls);

    return wrapper;
  }

  _knownSelectors() {
    const base = [
      '[class*="pronoun"]',
      '[id*="pronoun"]',
      '[aria-label*="Pronoun"]',
      '[aria-label*="pronoun"]',
      '[data-profile-section="pronouns"]',
      '[data-profile-section*="pronoun"]',
      '[data-pronouns]',
      '[data-pronoun]'
    ];

    return base.concat(this.config.extraSelectors || []);
  }

  _applyStyles() {
    const selectors = this._knownSelectors();
    const css = `${selectors.join(", ")} { display: none !important; }`;
    try { BdApi.DOM.addStyle(this.styleId, css); } catch (e) { console.error(`[${NOPRONUNS_PLUGIN_NAME}] addStyle error`, e); }
  }

  _removeStyles() {
    try { BdApi.DOM.removeStyle(this.styleId); } catch (_) {}
  }

  _observe() {
    if (this.observer) return;
    this.observer = new MutationObserver((mutations) => {
      if (!this.config.aggressive) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          this._sweep(node);
        }
      }
    });
    try {
      this.observer.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  _disconnect() {
    if (this.observer) {
      try { this.observer.disconnect(); } catch (_) {}
      this.observer = null;
    }
  }

  _sweep(root) {
    if (!this.config.aggressive) return;
    try {
      const headingCandidates = root.querySelectorAll("h1,h2,h3,h4,h5,h6,div,span,strong,label");
      for (const el of headingCandidates) {
        const txt = (el.textContent || "").trim();
        if (!txt) continue;
        if (/^pronouns$/i.test(txt)) {
          const container = this._closestSection(el) || el.parentElement;
          if (container && !container.hasAttribute(this.markerAttr)) {
            container.setAttribute(this.markerAttr, "");
            container.style.display = "none";
          }
        }
      }

      const chipCandidates = root.querySelectorAll("span,div");
      for (const el of chipCandidates) {
        if (el.hasAttribute(this.markerAttr)) continue;
        const txt = (el.textContent || "").trim();
        if (!txt) continue;
        if (/^(she\s*\/\s*her|he\s*\/\s*him|they\s*\/\s*them|it\s*\/\s*its|any\s*\/\s*all)$/i.test(txt)) {
          const tooLarge = (el.offsetWidth || 0) > 600 || (el.offsetHeight || 0) > 150;
          if (!tooLarge) {
            el.setAttribute(this.markerAttr, "");
            el.style.display = "none";
          }
        }
      }
    } catch (e) {
      console.error(`[${NOPRONUNS_PLUGIN_NAME}] sweep error`, e);
    }
  }

  _closestSection(el) {
    let cur = el;
    for (let i = 0; i < 6 && cur; i++) {
      if (cur.matches && (cur.matches('[class*="section"]') || cur.matches('[class*="profile"]') || cur.matches('[class*="userProfile"]') || cur.matches('[role="group"]'))) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  _revertInlineHides() {
    try {
      const hidden = document.querySelectorAll(`[${this.markerAttr}]`);
      for (const el of hidden) {
        el.style.removeProperty("display");
        el.removeAttribute(this.markerAttr);
      }
    } catch (_) {}
  }
};
