// ==UserScript==
// @name        Instragram Follower Analyzer
// @namespace   https://github.com/UNKchr/ig-analyzer
// @version     1.3.3
// @description Analyze Instagram followers and following lists to identify non-followers and ghost followers.
// @author      UNKchr
// @match       https://www.instagram.com/*
// @updateURL   https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js
// @downloadURL https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @run-at      document-idle
// @license     MIT
// ==/UserScript== 

(function() {
    'use strict';

    const CONFIG = {
      STORAGE_KEY: "ig_snapshot_v1",
      FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
      FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
      PAGE_SIZE: 50,
      RATE_LIMIT_MS: 1000
    };

    function sleep(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    function now() {
      return new Date().toISOString();
    }

    /* ======================= UI COMPONENTS ======================= */ 

  function createPanel() {
  if (document.getElementById("ig-analyzer-panel")) return;

  const panel = document.createElement("div");
  panel.id = "ig-analyzer-panel";
  
  panel.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 320px;
    min-width: 260px; 
    height: 380px;    
    min-height: 200px;
    background: #1e1e1e;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    padding: 16px;
    z-index: 99999999;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    border: 1px solid #333;
    box-sizing: border-box;
    display: flex;
    flex-direction: column; 
    resize: both;           
    overflow: hidden;       
  `;

  panel.innerHTML = `
    <style>
      #ig-analyzer-panel button {
        background: #2d2d2d;
        color: #fff;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1; 
      }
      #ig-analyzer-panel button:hover {
        background: #3d3d3d;
        border-color: #555;
      }
      #ig-analyzer-panel button#ig-run { background: #0d6efd; border-color: #0b5ed7; }
      #ig-analyzer-panel button#ig-run:hover { background: #0b5ed7; }
      #ig-analyzer-panel button#ig-export { background: #198754; border-color: #146c43; }
      #ig-analyzer-panel button#ig-export:hover { background: #146c43; }
      
      #ig-log::-webkit-scrollbar { width: 8px; }
      #ig-log::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 4px; }
      #ig-log::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
      #ig-log::-webkit-scrollbar-thumb:hover { background: #555; }
    </style>

    <div id="ig-header" style="font-weight: 600; font-size: 15px; margin-bottom: 12px; cursor: move; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
      <span>📊 IG Analyzer</span>
      <span id="ig-status" style="font-size: 11px; font-weight: normal; background: #333; padding: 3px 8px; border-radius: 12px; color: #bbb; letter-spacing: 0.5px;">Idle</span>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-shrink: 0;">
      <button id="ig-run">Run Analysis</button>
      <button id="ig-export">Export</button>
      <button id="ig-reset">Reset</button>
    </div>

    <pre id="ig-log" style="margin: 0; flex-grow: 1; overflow-y: auto; background: #0a0a0a; border: 1px solid #222; border-radius: 6px; padding: 10px; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #569cd6; white-space: pre-wrap; word-wrap: break-word;"></pre>
  `;

  document.body.appendChild(panel);

  const savedPos = loadPanelPosition();
  if (savedPos && typeof savedPos.x === "number") {
    panel.style.left = savedPos.x + "px";
    panel.style.top = savedPos.y + "px";
    panel.style.right = "auto";
  }

  const header = panel.querySelector("#ig-header");
  makePanelDraggable(panel, header);
}

function setStatus(text) {
  const el = document.getElementById("ig-status");
  if (el) el.textContent = text;
}

function log(msg) {
  const box = document.getElementById("ig-log");
  if (box) {
    box.textContent += `[${now()}] ${msg}\n`;
    box.scrollTop = box.scrollHeight;
  }
  if (CONFIG.DEBUG) console.log(msg);
}

function logError(msg, err) {
  log("ERROR: " + msg);
  if (err) log(String(err));
  if (CONFIG.DEBUG) console.error(msg, err);
}

const POSITION_KEY = "ig_panel_position_v1";

function savePanelPosition(x, y) {
  GM_setValue(POSITION_KEY, { x, y });
}

function loadPanelPosition() {
  return GM_getValue(POSITION_KEY, null);
}

    /* ======================= Storage ======================= */

    function loadSnapshot() {
      try {
        const snap = GM_getValue(CONFIG.STORAGE_KEY, null);
        if (!snap) return null;

        if (
          !Array.isArray(snap.followers) ||
          !Array.isArray(snap.following) 
        ) {
          throw new Error("Invalid snapshot structure");
        }

        if (!Array.isArray(snap.notFollowingBack)) {
          snap.notFollowingBack = [];
        }

        return snap;
      } catch (e) {
        logError("Failed to load snapshot", e);
        return null;
      }
    }

    function saveSnapshot(data) {
      GM_setValue(CONFIG.STORAGE_KEY, data);
    }

    function resetSnapshot() {
      GM_deleteValue(CONFIG.STORAGE_KEY);
    }

    /* ======================= CORE LOGIC ======================= */

    function makePanelDraggable(panel, handle) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", e => {
      isDragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;

      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", e => {
      if (!isDragging) return;

      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;

      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";

      savePanelPosition(x, y);
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;

      isDragging = false;
      document.body.style.userSelect = "";
    });
  }


    function getUserId() {
      const c = document.cookie
      .split("; ")
      .find(x => x.startsWith("ds_user_id="));
      return c ? c.split("=")[1] : null;
    }

    async function fetchGraphQL(hash, variables, label) {
      const url = 
        "https://www.instagram.com/graphql/query/?query_hash=" +
        hash +
        "&variables=" +
        encodeURIComponent(JSON.stringify(variables));

      try {
        const res = await fetch(url, { credentials: "include" });

        if (!res.ok) {
          if (res.status === 429) throw new Error("Rate limited by Instagram. Please wait and try again.");
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        const user = json?.data?.user;
        const edge = user?.edge_follow || user?.edge_followed_by;

        if (!edge || !Array.isArray(edge.edges)) {
          console.error(`Unexpected GraphQL structure in ${label}.`);
          throw new Error("Unexpected GraphQL structure. The API may have changed.");
        }

        return {
          edges: edge.edges,
          pageInfo: edge.page_info
        };
      } catch (e) {
        logError(`Failed to fetch ${label}`, e.message);
        throw e;
      }
    }

    async function getAllUsers(userId, hash, label) {
      const users = [];
      let cursor = null;
      let hasNext = true;

      while (hasNext) {
        log(`Fetching ${label} page`);

        const { edges, pageInfo } = await fetchGraphQL(
          hash,
          {id: userId, first: CONFIG.PAGE_SIZE, after: cursor },
          label
        );

        edges.forEach(e => {
          if (e?.node?.username) users.push(e.node.username);
        });

        hasNext = pageInfo?.has_next_page === true;
        cursor = pageInfo?.end_cursor || null;

        await sleep(CONFIG.RATE_LIMIT_MS);
      }

      log(`Total ${label} fetched: ${users.length}`);
      return users;
    }

    /* ======================= ANALYSIS ======================= */

    function diff(a, b) {
      try {
        const setB = new Set(b);
        return a.filter(x => !setB.has(x));
      } catch (e) {
        logError("Error computing diff", e);
        return [];
      }
    }

    /* ======================= MAIN ======================= */

    function computeDereivedData(followers, following) {
      return {
        notFollowingBack: diff(following, followers)
      };
    }

    async function runAnalysis() {
      setStatus("Running");
      log("Starting analysis...");

      try {
        const userId = getUserId();
        if (!userId) throw new Error("The user ID could not be obtained. Are you logged in?");

        const following = await getAllUsers(userId, 
          CONFIG.FOLLOWING_HASH, 
          "following"
        );

        const followers = await getAllUsers(userId,
          CONFIG.FOLLOWERS_HASH,
          "followers"
        );

        const notFollowingBackUsernames = diff(following, followers);

        const notFollowingBackDetailed = notFollowingBackUsernames.map(username => ({
          username: username,
          url: `https://www.instagram.com/${username}/`
        }));

        log(`Users not following back: ${notFollowingBackDetailed.length}`);

        const prev = loadSnapshot();
        if (prev) {
          const newFollowers = diff(followers, prev.followers);
          const lostFollowers = diff(prev.followers, followers);
          const silentUnfollows = lostFollowers.filter(u => following.includes(u));

          log("New followers:" + newFollowers.length);
          log("Lost followers: " + lostFollowers.length);
          log("Silent unfollows: " + silentUnfollows.length);
        } else {
          log("No previous snapshot found.");
        }

        saveSnapshot({
          version: 1,
          lastRun: now(),
          followers,
          following,
          notFollowingBack: notFollowingBackDetailed
        });

        setStatus("Done");
        log("Analysis completed successfully. You can export the results.");
      } catch (e) {
      setStatus("Error");
      logError("Analysis failed", e);
      }
    }
    /* ======================= INIT ======================= */

    createPanel();

    document.getElementById("ig-run").onclick = runAnalysis;
    document.getElementById("ig-export").onclick = () => {
      const snap = loadSnapshot();
      if (!snap) {
        log("No snapshot to export.");
        return;
      }
      const blob = new Blob([JSON.stringify(snap, null, 2)],
        { type: "application/json" });
      ;
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    };

    document.getElementById("ig-reset").onclick = () => {
      resetSnapshot();
      log("Snapshot reset.");
    };

    /* ======================= KEYBOARD SHORTCUTS ======================= */
    document.addEventListener('keydown', (e) => {

      const activeElement = document.activeElement;
      if (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable
      ) {
        return;
      }

      if (e.key === 'F9') {
        const panel = document.getElementById("ig-analyzer-panel");
        if (panel) {
          if (panel.style.display === "none") {
            panel.style.display = "flex";
          } else {
            panel.style.display = "none";
          }
        }
      }
    });

    log("IG Analyzer loaded. Press F9 to toggle panel.");
})();