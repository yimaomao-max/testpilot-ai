/**
 * Service Worker：注入调度、事件汇总、页面导航跟踪、步骤管理、选择器验证。
 */
const state = { recording: false, tabId: null };

/** 录制中跟踪页面跳转：URL 变化即追加 goto 步骤 */
function onTabUpdated(tabId, changeInfo, tab) {
  if (!state.recording || tabId !== state.tabId) return;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  const url = changeInfo.url || tab?.url;
  if (!url || /^(chrome|edge|about|devtools):/.test(url)) return;
  chrome.storage.local.get(["steps", "lastNavUrl"], ({ steps = [], lastNavUrl }) => {
    if (url === lastNavUrl) return;
    let where = url;
    try {
      const u = new URL(url);
      where = u.host + u.pathname;
    } catch {
      // 保留原样
    }
    steps.push({ type: "goto", value: url, description: `跳转到 ${where}` });
    chrome.storage.local.set({ steps, lastNavUrl: url });
  });
}

/** 页面内验证选择器唯一性（activeTab 授权范围内） */
function verifySelectors(selectors) {
  return selectors.map((sel) => {
    try {
      return { selector: sel, count: document.querySelectorAll(sel).length };
    } catch {
      return { selector: sel, count: -1 };
    }
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "TESTPILOT_START") {
    state.recording = true;
    state.tabId = msg.tabId;
    chrome.storage.local.set({
      recording: true,
      mode: "action",
      steps: [],
      url: msg.url,
      lastNavUrl: msg.url,
      recordedAt: Date.now(),
    });
    if (!chrome.tabs.onUpdated.hasListener(onTabUpdated)) {
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }
    chrome.scripting
      .executeScript({ target: { tabId: msg.tabId }, files: ["recorder.js"] })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        state.recording = false;
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg.type === "TESTPILOT_STOP") {
    state.recording = false;
    chrome.storage.local.set({ recording: false });
    if (msg.tabId) chrome.tabs.sendMessage(msg.tabId, { type: "TESTPILOT_STOP" }).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "TESTPILOT_MODE") {
    chrome.storage.local.set({ mode: msg.mode });
    if (state.tabId) {
      chrome.tabs.sendMessage(state.tabId, { type: "TESTPILOT_MODE", mode: msg.mode }).catch(() => {});
    }
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "TESTPILOT_EVENT") {
    chrome.storage.local.get(["steps"], (data) => {
      const steps = data.steps || [];
      const typeMap = {
        click: "click",
        input: "fill",
        select: "select",
        press: "press",
        assertText: "expectText",
        assertVisible: "expectVisible",
      };
      steps.push({
        type: typeMap[msg.event] || "click",
        selector: msg.selector,
        selectorCandidates: Array.isArray(msg.candidates) ? msg.candidates.slice(0, 4) : undefined,
        value: msg.value,
        description: msg.description,
      });
      chrome.storage.local.set({ steps });
    });
    return;
  }

  if (msg.type === "TESTPILOT_DELETE_STEP") {
    chrome.storage.local.get(["steps"], ({ steps = [] }) => {
      steps.splice(msg.index, 1);
      chrome.storage.local.set({ steps });
    });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "TESTPILOT_MOVE_STEP") {
    chrome.storage.local.get(["steps"], ({ steps = [] }) => {
      const i = msg.index;
      const j = i + (msg.dir === "up" ? -1 : 1);
      if (j < 0 || j >= steps.length) {
        sendResponse({ ok: false });
        return;
      }
      [steps[i], steps[j]] = [steps[j], steps[i]];
      chrome.storage.local.set({ steps });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "TESTPILOT_VERIFY") {
    chrome.scripting
      .executeScript({
        target: { tabId: msg.tabId },
        func: verifySelectors,
        args: [msg.selectors],
      })
      .then((r) => sendResponse({ ok: true, results: r[0]?.result ?? [] }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
