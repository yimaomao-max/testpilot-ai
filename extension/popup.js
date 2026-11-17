const $ = (id) => document.getElementById(id);
const msg = (text, cls = "") => { $("msg").textContent = text; $("msg").className = cls; };

let currentSteps = [];
let verifyResults = null;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isAssert = (t) => t === "expectText" || t === "expectVisible";
const TYPE_CN = {
  click: "点击", fill: "输入", select: "选择", press: "按键",
  expectText: "断言文本", expectVisible: "断言可见", goto: "跳转",
};

function renderSteps() {
  const box = $("steps");
  if (!currentSteps.length) {
    box.innerHTML = '<div class="step" style="color:#475569">尚无录制步骤</div>';
    return;
  }
  box.innerHTML = currentSteps.map((s, i) => {
    const v = verifyResults?.get(s.selector);
    const badge = v === undefined ? "" : v === 1 ? " OK" : v === -1 ? " BAD" : " x" + v;
    return '<div class="step"><div class="txt"><div class="d">' + (i + 1) + ". " +
      (isAssert(s.type) ? '<span class="assert">断言</span> ' : "") +
      escapeHtml(s.description || TYPE_CN[s.type] || s.type) + badge + "</div>" +
      (s.selector ? "<code>" + escapeHtml(s.selector) + "</code>" : "") + "</div>" +
      '<button data-act="up" data-i="' + i + '">up</button>' +
      '<button data-act="down" data-i="' + i + '">down</button>' +
      '<button data-act="del" data-i="' + i + '">x</button></div>';
  }).join("");
}

$("steps").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  if (btn.dataset.act === "del") {
    chrome.runtime.sendMessage({ type: "TESTPILOT_DELETE_STEP", index: i });
  } else {
    chrome.runtime.sendMessage({ type: "TESTPILOT_MOVE_STEP", index: i, dir: btn.dataset.act });
  }
});

function refresh() {
  chrome.storage.local.get(["recording", "steps", "url", "mode"], ({ recording, steps, url, mode }) => {
    currentSteps = steps || [];
    $("dot").classList.toggle("on", !!recording);
    $("start").disabled = !!recording;
    $("stop").disabled = !recording;
    $("save").disabled = !currentSteps.length || !!recording;
    $("verify").disabled = !!recording || !currentSteps.length;
    $("export").disabled = !currentSteps.length;
    $("modeAction").classList.toggle("active", mode !== "assert");
    $("modeAssert").classList.toggle("active", mode === "assert");
    renderSteps();
    window.__tpUrl = url;
  });
}

function setMode(mode) {
  chrome.runtime.sendMessage({ type: "TESTPILOT_MODE", mode });
  setTimeout(refresh, 100);
}
$("modeAction").addEventListener("click", () => setMode("action"));
$("modeAssert").addEventListener("click", () => setMode("assert"));

$("start").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || /^(chrome|edge|about):/.test(tab.url)) {
    msg("请在普通网页上开始录制", "err");
    return;
  }
  const res = await chrome.runtime.sendMessage({ type: "TESTPILOT_START", tabId: tab.id, url: tab.url });
  if (res?.ok) {
    verifyResults = null;
    $("verdict").textContent = "";
    msg("录制中：点击/输入/下拉都会记录；切换上方按钮可录断言");
    refresh();
  } else {
    msg("注入失败：" + (res?.error || "未知错误"), "err");
  }
});

$("stop").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: "TESTPILOT_STOP", tabId: tab?.id });
  msg("已停止，可验证选择器后保存");
  refresh();
});

$("clear").addEventListener("click", () => {
  chrome.storage.local.set({ steps: [] });
  verifyResults = null;
  $("verdict").textContent = "";
  refresh();
});

$("verify").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const selectors = [...new Set(currentSteps.map((s) => s.selector).filter(Boolean))];
  if (!selectors.length) return;
  msg("正在页面中验证…");
  const res = await chrome.runtime.sendMessage({ type: "TESTPILOT_VERIFY", tabId: tab?.id, selectors });
  if (!res?.ok) {
    msg("验证失败：" + (res?.error || "请回到被录制的页面再试"), "err");
    return;
  }
  verifyResults = new Map(res.results.map((r) => [r.selector, r.count]));
  const bad = res.results.filter((r) => r.count !== 1).length;
  $("verdict").textContent = "选择器 " + (res.results.length - bad) + "/" + res.results.length + " 唯一";
  msg(bad ? bad + " 个选择器需人工检查（重复/无效）" : "全部选择器唯一，可放心保存", bad ? "err" : "ok");
  renderSteps();
});

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ url: window.__tpUrl, steps: currentSteps }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "testpilot-steps.json";
  a.click();
});

async function loadProjects() {
  try {
    const data = await (await fetch("http://localhost:3100/api/projects")).json();
    for (const p of data.projects ?? []) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      $("project").appendChild(opt);
    }
  } catch {
    /* 服务未启动时保持不关联 */
  }
}

$("project").addEventListener("change", async () => {
  $("requirement").innerHTML = '<option value="">不关联</option>';
  const pid = $("project").value;
  if (!pid) return;
  try {
    const data = await (await fetch("http://localhost:3100/api/requirements?projectId=" + pid)).json();
    for (const r of data.requirements ?? []) {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.title;
      $("requirement").appendChild(opt);
    }
  } catch {
    /* 忽略 */
  }
});

$("save").addEventListener("click", async () => {
  const { steps = [], url } = await chrome.storage.local.get(["steps", "url"]);
  const targetUrl = url || window.__tpUrl;
  if (!steps.length || !targetUrl) return;
  const name = $("name").value.trim() || "录制的测试用例";
  const payload = {
    url: targetUrl,
    name,
    description: "由 TestPilot Recorder 浏览器插件录制",
    projectId: $("project").value || undefined,
    requirementId: $("requirement").value || undefined,
    // goto 由服务端根据用例 URL 自动注入，这里只传交互/断言步骤
    steps: steps.filter((s) => s.type !== "goto"),
  };
  msg("保存中…");
  try {
    const res = await fetch("http://localhost:3100/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "保存失败");
    $("msg").textContent = "已创建用例：";
    $("msg").className = "ok";
    const link = document.createElement("a");
    link.href = "http://localhost:3100/tests/" + data.test.id;
    link.textContent = data.test.name;
    link.target = "_blank";
    $("msg").appendChild(document.createElement("br"));
    $("msg").appendChild(link);
  } catch (err) {
    msg("保存失败：" + err.message + "（确认 TestPilot dev server 已启动）", "err");
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.steps || changes.mode)) refresh();
});
loadProjects();
refresh();
