/**
 * Generates the browser-console script that actually attaches the widget to
 * a Discord profile. This is NOT something our server can do — the
 * `PUT /users/@me/widgets` call only works with the live discord.com session
 * token pulled from the page's own webpack internals, not a portable OAuth
 * Bearer token, which is why lib/discord/oauth.ts's attach/detach functions
 * (server-side, using an OAuth token) never worked. The user must paste this
 * into their own browser console once, logged into discord.com.
 *
 * expectedDiscordUserId (the dashboard session's own Discord snowflake) is
 * baked in purely as a safety check: if the browser is logged into a
 * different Discord account than the one that generated this script, it
 * refuses rather than silently attaching the widget to the wrong profile.
 */
export function buildLinkConsoleSnippet(applicationId: string, expectedDiscordUserId: string): string {
  return `// Paste into the devtools console on discord.com, then refresh your profile.
// Re-run any time you need to re-attach the widget (e.g. after Discord drops it).
(async () => {
  var APP_ID = "${applicationId}";
  var EXPECTED_USER_ID = "${expectedDiscordUserId}";

  var token, uid;
  window.webpackChunkdiscord_app.push([[Symbol()], {}, function (r) {
    var mods = Object.values(r.c);
    for (var i = 0; i < mods.length; i++) {
      var m = mods[i];
      try {
        if (!m.exports || m.exports === window) continue;
        for (var k in m.exports) {
          var ex = m.exports[k];
          if (!ex || ex[Symbol.toStringTag] === "IntlMessagesProxy") continue;
          if (!token && ex.getToken) token = ex.getToken();
          if (!uid && ex.getCurrentUser && ex.getCurrentUser() && ex.getCurrentUser().id) uid = ex.getCurrentUser().id;
        }
        if (token && uid) break;
      } catch (e) {}
    }
  }]);
  window.webpackChunkdiscord_app.pop();
  if (!token || !uid) return console.error("[Widget] Could not read token/user — are you logged in on discord.com?");

  if (uid !== EXPECTED_USER_ID) {
    console.error("[Widget] Wrong account: this browser is logged in as " + uid + ", but this script was generated for " + EXPECTED_USER_ID + ".");
    console.error("[Widget] Open discord.com on the same account you used to log into the dashboard, then re-run this.");
    return;
  }

  var headers = { Authorization: token, "Content-Type": "application/json" };
  var ours = { data: { type: "application", application_id: APP_ID } };
  function put(list, extra) {
    return fetch("/api/v9/users/@me/widgets", {
      method: "PUT",
      headers: Object.assign({}, headers, extra || {}),
      body: JSON.stringify({ widgets: list }),
    });
  }

  var existing = [];
  try {
    var profile = await fetch("/api/v9/users/" + uid + "/profile", { headers: headers }).then(function (r) { return r.json(); });
    existing = (profile.widgets || []).filter(function (w) { return !w.data || w.data.application_id !== APP_ID; });
  } catch (e) {
    console.warn("[Widget] Could not list existing widgets, will only push ours:", e);
  }

  // A stale widget entry (deleted app-side but still replayed by Discord) can
  // block the whole save with a 401/40001 or 400/50035. Recover by keeping
  // only ours, then re-adding the rest one at a time, dropping whichever one
  // Discord rejects.
  async function recoverStale(extra) {
    console.warn("[Widget] Save refused — checking for a stale widget entry...");
    var base = await put([ours], extra);
    if (!base.ok) {
      console.error("[Widget] Discord refused even our own widget — reload discord.com (Ctrl+Shift+R) or re-log in, then re-run this.");
      return;
    }
    var kept = [ours];
    for (var i = 0; i < existing.length; i++) {
      var w = existing[i];
      if ((await put(kept.concat([w]), extra)).ok) kept.push(w);
    }
    console.log("[Widget] Recovered. Kept " + (kept.length - 1) + " of " + existing.length + " existing widget(s). Refresh your profile.");
  }

  var res = await put([ours].concat(existing));
  if (res.ok) return console.log("[Widget] Added. " + existing.length + " existing widget(s) preserved. Refresh your profile.");

  var body = null;
  try { body = await res.json(); } catch (e) {}

  // Fresh 2FA elevation required.
  if (res.status === 401 && body && body.code === 60003 && body.mfa && body.mfa.ticket) {
    var code = prompt("[Widget] Enter your Discord 2FA code:");
    if (!code) return console.error("[Widget] No code entered — aborted.");
    var clean = String(code).replace(/[^0-9a-z-]/gi, "");
    var mfaRes = await fetch("/api/v9/mfa/finish", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ ticket: body.mfa.ticket, mfa_type: clean.indexOf("-") >= 0 ? "backup" : "totp", data: clean }),
    });
    var mfaBody = await mfaRes.json().catch(function () { return {}; });
    if (!mfaRes.ok || !mfaBody.token) return console.error("[Widget] 2FA failed:", mfaBody.message || mfaRes.status);

    res = await put([ours].concat(existing), { "X-Discord-MFA-Authorization": mfaBody.token });
    if (res.ok) return console.log("[Widget] Added after 2FA. " + existing.length + " existing widget(s) preserved. Refresh your profile.");
    body = null; try { body = await res.json(); } catch (e) {}
    return console.error("[Widget] Failed after 2FA: " + res.status + " —", body && body.message || body);
  }

  if ((res.status === 401 && body && body.code === 40001) || (res.status === 400 && body && body.code === 50035)) {
    return recoverStale();
  }

  console.error("[Widget] Failed: " + res.status + " —", body && body.message || body);
})();`;
}
