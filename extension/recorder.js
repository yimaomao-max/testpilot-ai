/**
 * 注入到目标页面的录制脚本。
 * 选择器策略（参考资料库 getOptimalXPath 阶梯 + web-heal 评分表）：
 *   id → data-testid → role+可访问名 → 表单 name → aria-label → 唯一 text → CSS 层级
 * 每个候选实时验证唯一性；产出有序候选列表供平台执行失败时自愈回退。
 * 模式由 background 通过 TESTPILOT_MODE 消息切换（action | assert）。
 */
(function () {
  if (window.__testpilotRecorderActive) return;
  window.__testpilotRecorderActive = true;

  let mode = "action";
  let lastClick = { selector: "", at: 0 };

  function setMode(next) {
    if (next === "action" || next === "assert") mode = next;
  }

  // ---------- 选择器阶梯 ----------
  const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/"/g, "&quot;");

  function countMatches(sel) {
    try { return document.querySelectorAll(sel).length; } catch { return -1; }
  }

  function accName(el) {
    return (el.getAttribute("aria-label") || el.getAttribute("placeholder") ||
      el.getAttribute("value") || (el.innerText || "").trim() || "").trim().slice(0, 40);
  }

  function getRole(el) {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const tagMap = { A: "link", BUTTON: "button", SELECT: "combobox", TEXTAREA: "textbox", H1: "heading", H2: "heading", H3: "heading" };
    if (el.tagName === "INPUT") {
      const im = { text: "textbox", search: "searchbox", email: "textbox", tel: "textbox", url: "textbox", password: "textbox", checkbox: "checkbox", radio: "radio" };
      return im[el.type || "text"] || "textbox";
    }
    return tagMap[el.tagName] || null;
  }

  /** 同类同名近似唯一性检查（role=/text= 引擎无法用 querySelectorAll 计数） */
  function sameNameCount(el, name) {
    const role = getRole(el);
    let scope;
    if (el.getAttribute("role")) scope = document.querySelectorAll('[role="' + role + '"]');
    else if (role) scope = document.querySelectorAll(el.tagName.toLowerCase());
    else scope = document.querySelectorAll(el.tagName.toLowerCase());
    let n = 0;
    for (const node of scope) { if (accName(node) === name) n++; }
    return n;
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    const segments = [];
    let node = el;
    while (node && node.nodeType === 1 && segments.length < 4) {
      let seg = node.tagName.toLowerCase();
      if (node.id) { segments.unshift("#" + CSS.escape(node.id)); break; }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) seg += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
      }
      segments.unshift(seg);
      node = parent;
    }
    return segments.join(" > ");
  }

  /** 有序候选选择器（最多 4 个，首个为主选择器） */
  function buildCandidates(el) {
    const out = [];
    const push = (sel) => { if (sel && sel.length < 200 && !out.includes(sel)) out.push(sel); };

    if (el.id && countMatches("#" + CSS.escape(el.id)) === 1) push("#" + CSS.escape(el.id));

    const tid = el.getAttribute("data-testid") || el.getAttribute("data-test");
    if (tid && countMatches('[data-testid="' + esc(tid) + '"]') === 1) push('[data-testid="' + esc(tid) + '"]');

    const role = getRole(el);
    const name = accName(el);
    if (role && name && sameNameCount(el, name) === 1) push("role=" + role + '[name="' + esc(name) + '"]');

    if (el.name && countMatches(el.tagName.toLowerCase() + '[name="' + esc(el.name) + '"]') === 1) {
      push(el.tagName.toLowerCase() + '[name="' + esc(el.name) + '"]');
    }

    const al = el.getAttribute("aria-label");
    if (al && countMatches('[aria-label="' + esc(al) + '"]') === 1) push('[aria-label="' + esc(al) + '"]');

    const txt = (el.innerText || "").trim();
    if (txt && txt.length <= 30 && sameNameCount(el, txt) === 1) push("text=" + txt);

    push(cssPath(el));
    return out.slice(0, 4);
  }

  // ---------- 高风险识别（heal 规范：支付/删除类只取证不自愈） ----------
  const RISKY = /删除|支付|结算|退款|下单|提交订单|注销|delete|remove|pay|checkout|purchase/i;
  function isRisky(el) {
    if (el instanceof HTMLInputElement && el.type === "password") return true;
    return RISKY.test((el.innerText || "").trim()) || RISKY.test(el.getAttribute("aria-label") || "");
  }

  // ---------- 高亮与事件发送 ----------
  function highlight(el) {
    try {
      const old = el.style.cssText;
      el.style.cssText += ";outline: 2px solid #0ea5e9 !important; outline-offset: 1px !important;";
      setTimeout(() => { el.style.cssText = old; }, 350);
    } catch { /* 部分元素样式只读 */ }
  }

  function shortText(el) {
    return (el.innerText || el.value || "").trim().slice(0, 20);
  }

  function send(event, data) {
    chrome.runtime.sendMessage({ type: "TESTPILOT_EVENT", event, ...data }).catch(() => {});
  }

  function onClick(e) {
    const el = e.target.closest(
      "a,button,[role=button],input[type=submit],input[type=button],input[type=checkbox],input[type=radio],label,li,select,span,div,h1,h2,h3,[tabindex]"
    );
    if (!el) return;
    if (el.tagName === "INPUT" && !["submit", "button", "checkbox", "radio"].includes(el.type)) return;

    const candidates = buildCandidates(el);
    const selector = candidates[0] || "";
    const now = Date.now();
    if (selector === lastClick.selector && now - lastClick.at < 400) return;
    lastClick = { selector, at: now };
    highlight(el);

    const risk = isRisky(el) ? "⚠高风险：" : "";

    if (mode === "assert") {
      const text = (el.innerText || "").trim().slice(0, 80);
      send(text ? "assertText" : "assertVisible", {
        selector, candidates, value: text,
        description: risk + (text ? "断言页面包含文本「" + text.slice(0, 12) + "」" : "断言元素可见"),
      });
      return;
    }

    send("click", {
      selector, candidates,
      description: risk + (shortText(el) ? "点击「" + shortText(el) + "」" : "操作 <" + el.tagName.toLowerCase() + ">"),
    });
  }

  function onChange(e) {
    const el = e.target;
    if (el instanceof HTMLSelectElement) {
      highlight(el);
      const label = (el.selectedOptions[0] && el.selectedOptions[0].text) || el.value;
      send("select", {
        selector: buildCandidates(el)[0] || cssPath(el),
        candidates: buildCandidates(el),
        value: label,
        description: "选择下拉项「" + label + "」",
      });
      return;
    }
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
    if (["submit", "button"].includes(el.type)) return;
    const sensitive = el.type === "password";
    send("input", {
      selector: buildCandidates(el)[0] || cssPath(el),
      candidates: buildCandidates(el),
      value: sensitive ? "" : (el.value || "").slice(0, 100),
      description: (sensitive ? "⚠高风险：" : "") + (sensitive ? "在密码框输入（已脱敏）" : "在输入框输入「" + (el.value || "").slice(0, 10) + "」"),
    });
  }

  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || ["textarea", "checkbox", "radio"].includes(el.type)) return;
    send("press", {
      selector: buildCandidates(el)[0] || cssPath(el),
      candidates: buildCandidates(el),
      value: "Enter",
      description: "在输入框按回车提交",
    });
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "TESTPILOT_STOP") {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.__testpilotRecorderActive = false;
      sendResponse({ ok: true });
    }
    if (msg.type === "TESTPILOT_MODE") setMode(msg.mode);
    if (msg.type === "TESTPILOT_PING") sendResponse({ active: true, mode });
  });
})();
