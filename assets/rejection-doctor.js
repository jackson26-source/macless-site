/* Rejection Doctor — client-side, rule-based match against Apple's own
   App Store Review Guidelines and the wording Apple actually sends in
   Resolution Center messages. No data leaves the browser: this file
   does the matching entirely with regex/keyword scoring against the
   pasted text, no network request is made with what the user pastes. */

(function () {
  var CATEGORIES = [
    {
      guideline: "2.1",
      aliases: ["2\\.1\\s*\\(a\\)", "2\\.1a", "app completeness"],
      title: "App Completeness — crashes, bugs, or an incomplete build",
      keywords: ["crash", "crashed", "unresponsive", "freeze", "froze", "bug", "unable to complete your review", "incomplete", "placeholder"],
      explain: "Apple's reviewer hit a crash, a frozen screen, or something that just didn't work while testing your build, or the submission itself was incomplete (missing metadata, a broken URL, placeholder text still in it).",
      fix: "Install the exact build Apple reviewed on a real device (not just the Simulator) and walk every screen yourself. If your app needs a login, include a working demo account in the App Review Information notes, reviewers can't test what they can't get into. If a backend/API is involved, make sure it's actually live and reachable, a dev server that's down at review time reads as \"crashes.\""
    },
    {
      guideline: "2.1",
      aliases: ["demo account", "reviewer.*(log ?in|access)", "unable to (sign ?in|log ?in)"],
      title: "App Completeness — reviewer couldn't get into the app",
      keywords: ["demo account", "sign in", "log in", "login credentials", "test account", "reviewer notes"],
      explain: "The reviewer couldn't access a part of your app that needs an account, a subscription, or some other gate, and you didn't give them a way in.",
      fix: "Add working demo credentials (or a review-mode toggle) in App Store Connect's App Review Information notes, not just in the app itself. If the account needs specific data to show real functionality (an active subscription, sample content), make sure the demo account actually has it."
    },
    {
      guideline: "2.1(b)",
      aliases: ["2\\.1\\s*\\(b\\)", "in-app purchase.*(not|isn't).*(functio|visible|work)"],
      title: "App Completeness — in-app purchases not working or not visible",
      keywords: ["in-app purchase", "iap", "purchase could not be completed", "unable to locate", "products not loading"],
      explain: "Apple couldn't find, load, or complete one of your listed in-app purchases during review. This usually means the products aren't approved/ready in App Store Connect yet, or the app can't actually reach StoreKit correctly at review time.",
      fix: "Confirm every IAP product is in \"Ready to Submit\" status in App Store Connect (not just created), submitted alongside the build, and tested end-to-end against the sandbox environment before resubmitting. If an IAP is mentioned in your review notes but doesn't exist yet, remove the mention or finish setting it up first."
    },
    {
      guideline: "2.3.1",
      aliases: ["2\\.3\\.1", "hidden.*(feature|functionality)", "undocumented"],
      title: "Accurate Metadata — hidden or undocumented features",
      keywords: ["hidden feature", "undisclosed", "undocumented", "not described in your review notes"],
      explain: "Your app does something Apple's reviewer found that wasn't described anywhere in your app's metadata or review notes, this is treated as a transparency problem even if the feature itself is harmless.",
      fix: "List every non-obvious feature explicitly in the App Store Connect \"Notes for Review\" box, generic descriptions get rejected too, be specific about what it does and how to reach it. If a feature is genuinely dormant/unfinished, remove it from this build rather than leaving it half-wired."
    },
    {
      guideline: "2.3.3",
      aliases: ["2\\.3\\.3", "screenshot"],
      title: "Accurate Metadata — screenshots don't show the app in use",
      keywords: ["screenshot", "splash screen", "login screen only", "title screen"],
      explain: "Your App Store screenshots show a splash, login, or title screen instead of the actual app being used, Apple wants screenshots to reflect the real in-use experience.",
      fix: "Replace at least most screenshots with real captures of core screens in use, not just the entry point. Text/image overlays and callouts are fine as long as the underlying screenshot is a real screen from the app."
    },
    {
      guideline: "2.3.7",
      aliases: ["2\\.3\\.7", "app name", "keyword.*(stuff|spam)"],
      title: "Accurate Metadata — app name or keywords",
      keywords: ["app name", "subtitle", "keyword", "trademarked", "30-character"],
      explain: "Your app's name, subtitle, or keyword list is packed with trademarked terms, other apps' names, pricing info, or irrelevant phrases meant to game search.",
      fix: "Keep the app name to a real, distinct name (30-character limit), move any descriptive phrase into the subtitle, and remove any competitor names, price mentions, or unrelated popular search terms from the keyword field."
    },
    {
      guideline: "3.1.1",
      aliases: ["3\\.1\\.1", "external.*(payment|purchase) link", "bypass.*(in-app|iap)"],
      title: "Payments — must use In-App Purchase, not an external link",
      keywords: ["in-app purchase", "external payment", "pay outside the app", "stripe", "paypal link"],
      explain: "Your app unlocks digital content, features, or a subscription through something other than Apple's own In-App Purchase system, a website checkout link, an external payment flow, a promo code redemption for digital goods, etc.",
      fix: "Route any purchase that unlocks in-app digital content or functionality through StoreKit / In-App Purchase. Selling physical goods or services delivered outside the app (this generally doesn't apply to Macless, which is sold entirely off-app on your own website, not through an iOS app listing) is a separate, allowed case, if your rejection is about something like that specifically, the fix is different, read Guideline 3.1.3 directly rather than assuming this applies."
    },
    {
      guideline: "3.1.2",
      aliases: ["3\\.1\\.2", "subscription.*(unclear|value|term)"],
      title: "Payments — subscription terms or value unclear",
      keywords: ["subscription", "auto-renew", "free trial", "recurring"],
      explain: "Apple wants clearer disclosure of what a subscription actually includes, its price, length, and renewal terms, before the user taps to buy, or thinks the subscription doesn't provide enough ongoing value to justify being a subscription rather than a one-time purchase.",
      fix: "Show subscription length, price, and what's included clearly before the purchase screen, App Store Connect's own subscription description field should also spell this out plainly. If your product is really a one-time unlock, consider whether it should be a non-consumable IAP instead of a subscription."
    },
    {
      guideline: "4.1",
      aliases: ["4\\.1\\s*\\(a\\)", "4\\.1a", "copycat", "spam.*(app|category)"],
      title: "Design — too similar to an existing app (copycat)",
      keywords: ["copycat", "clone", "similar to an existing", "repackaged", "minor changes"],
      explain: "Apple's reviewer thinks your app is a close copy of a popular app, or a repackaged version of a common app type with only cosmetic differences.",
      fix: "Point to specific, concrete features that make your app meaningfully different in the App Review notes, generic descriptions like \"it's better designed\" won't help. If the app really is a common category (flashlight, timer, wallpaper, etc.), Apple explicitly wants a real functional improvement, not just a different look, before it'll approve a new entry."
    },
    {
      guideline: "4.2",
      aliases: ["4\\.2(?!\\.\\d)\\b", "minimum functionality", "website wrapper", "webview"],
      title: "Design — minimum functionality (feels like a wrapped website)",
      keywords: ["minimum functionality", "website wrapper", "webview", "not app-like"],
      explain: "Apple thinks your app doesn't do enough beyond loading a website in a WebView, it wants something that feels native and \"app-like,\" with real UI, not just a browser wrapper.",
      fix: "Add native functionality that wouldn't work as well as a plain website: push notifications, offline support, native navigation/gestures, device integrations (camera, share sheet, widgets). The more of your UI that's actual native code rather than an embedded web page, the stronger this argument gets."
    },
    {
      guideline: "4.2.3",
      aliases: ["4\\.2\\.3", "requires.*(another app|companion app)", "app independence"],
      title: "Design — app requires another app or account to function",
      keywords: ["requires another app", "companion app", "doesn't work standalone", "install another app"],
      explain: "Your app doesn't do anything useful on its own, it needs a separate app, hardware pairing, or an account created somewhere else before a reviewer can test any real functionality.",
      fix: "Make sure the reviewer can get to genuine functionality without a separate app install. If hardware pairing is genuinely required (a companion app for a physical device), say so explicitly in the review notes and, if possible, provide a way to demo the experience without the physical hardware present."
    },
    {
      guideline: "4.3",
      aliases: ["4\\.3\\s*\\(b\\)", "4\\.3b", "spam"],
      title: "Design — Spam (too similar to your own or others' existing apps)",
      keywords: ["spam", "multiple bundle ids", "indistinguishable from", "low effort"],
      explain: "Either you've submitted near-duplicate apps under different bundle IDs (separate apps per city or team instead of one app with variations inside it), or your app falls into a category Apple treats as low-effort by default (flashlight, wallpaper, fortune-telling, etc.) without enough differentiation.",
      fix: "If it's the multiple-bundle-IDs case: consolidate into one app and use in-app purchase or content variations instead of separate App Store listings. If it's the low-effort-category case: this is the same fix as Guideline 4.1 above, add specific, real functionality and describe it plainly in the review notes."
    },
    {
      guideline: "5.1.1",
      aliases: ["5\\.1\\.1(?!\\s*\\()", "privacy policy"],
      title: "Privacy — missing or broken privacy policy link",
      keywords: ["privacy policy", "privacy policy link", "privacy policy url"],
      explain: "Your privacy policy link is missing, broken, or doesn't actually describe what data your app collects. Apple checks the App Store Connect metadata link and the in-app link separately, both have to work.",
      fix: "Host a real, specific privacy policy (not a generic template) that states what data you collect, why, and how a user can request deletion. Link it in both App Store Connect's App Privacy section and somewhere reachable inside the app itself (usually Settings), and click the link yourself before resubmitting, a 404 here is a very common, easy-to-miss cause."
    },
    {
      guideline: "5.1.1(v)",
      aliases: ["5\\.1\\.1\\s*\\(v\\)", "account deletion", "delete.*account"],
      title: "Privacy — no way to delete your account in the app",
      keywords: ["account deletion", "delete account", "delete my account"],
      explain: "Your app lets someone create an account but doesn't offer a way to delete it from inside the app. Apple explicitly does not accept an email-support-request workaround for this.",
      fix: "Add a real, functional \"Delete Account\" control somewhere reachable in the app (typically Settings), it needs to actually remove the account and associated data, not just log the user out or open an email draft."
    },
    {
      guideline: "5.1.2",
      aliases: ["5\\.1\\.2", "tracking", "app tracking transparency", "\\batt\\b"],
      title: "Privacy — tracking or third-party data sharing without proper consent",
      keywords: ["app tracking transparency", "att prompt", "idfa", "third-party sdk", "undisclosed sharing"],
      explain: "Your app (or an SDK inside it) shares data with a third party for tracking or advertising purposes without the required App Tracking Transparency prompt, or without disclosing it accurately in your App Privacy nutrition label.",
      fix: "Audit every third-party SDK for what it actually collects (ad networks and analytics SDKs are the usual culprits), make sure your App Privacy answers in App Store Connect match reality, and show Apple's ATT permission prompt before any cross-app/cross-site tracking happens, not after."
    },
    {
      guideline: "5.1.4",
      aliases: ["5\\.1\\.4", "kids category", "children.*(privacy|data)"],
      title: "Privacy — Kids category or child-data compliance",
      keywords: ["kids category", "coppa", "children's privacy", "parental gate"],
      explain: "Your app is in, or reads as intended for, the Kids category, and either includes third-party analytics/advertising it shouldn't, is missing a parental gate around something that needs one, or doesn't fully comply with children's privacy law (COPPA and similar).",
      fix: "Remove third-party analytics/advertising SDKs from anything a child could reach without a parental gate, add a real parental gate (usually a simple math problem, not just a button) in front of any external link, purchase, or data collection, and make sure your privacy policy specifically addresses children's data."
    },
    {
      guideline: "5.1.5",
      aliases: ["5\\.1\\.5", "location services"],
      title: "Privacy — location services used without a clear enough purpose",
      keywords: ["location services", "location data", "background location"],
      explain: "Your app requests location access but Apple's reviewer couldn't tell why it needs it, especially background location, which gets extra scrutiny.",
      fix: "Write a specific, plain-English purpose string for each location permission (Xcode's `NSLocationWhenInUseUsageDescription` / `NSLocationAlwaysAndWhenInUseUsageDescription`), explaining exactly what feature needs it. If you're requesting \"Always\" access, be ready to justify why \"When In Use\" isn't enough, that's usually the real question being asked."
    },
    {
      guideline: "—",
      aliases: ["xcode 26", "ios 26 sdk", "outdated sdk", "built with an older"],
      title: "Build requirement — app wasn't built with the current Xcode/SDK",
      keywords: ["xcode 26", "ios 26 sdk", "current xcode", "build with the latest"],
      explain: "Apple periodically requires new submissions to be built with a specific minimum Xcode and SDK version, independent of what iOS version your app actually supports at runtime.",
      fix: "Update the Xcode version your CI pipeline builds with (your app's deployment target/minimum supported iOS version can stay exactly the same, this is about the SDK used to build, not the OS versions you support), then rebuild and resubmit."
    },
    {
      guideline: "—",
      aliases: ["other app store review guideline issue", "binary rejected"],
      title: "Generic \"other guideline issue\" with no clear specifics",
      keywords: ["other app store review guideline", "we found the following issues"],
      explain: "This is Apple's most frustrating rejection type, a generic notice with little or no specific explanation attached.",
      fix: "Reply directly inside the Resolution Center thread in App Store Connect (not just email) asking the reviewer to clarify specifically what triggered it, this often gets a real answer within a day or two. You can also request a phone call with App Review from the same Resolution Center thread if the back-and-forth stalls."
    }
  ];

  function escapeForRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function scoreCategory(cat, textLower) {
    var score = 0;
    var aliasHit = false;
    (cat.aliases || []).forEach(function (a) {
      try {
        var re = new RegExp(a, "i");
        if (re.test(textLower)) { score += 10; aliasHit = true; }
      } catch (e) { /* skip malformed pattern */ }
    });
    (cat.keywords || []).forEach(function (k) {
      if (textLower.indexOf(k.toLowerCase()) !== -1) score += 2;
    });
    return { score: score, aliasHit: aliasHit };
  }

  function diagnose() {
    var input = document.getElementById("rdInput").value || "";
    var textLower = input.toLowerCase();
    var resultsEl = document.getElementById("rdResults");
    var emptyEl = document.getElementById("rdEmpty");
    var countEl = document.getElementById("rdCount");
    resultsEl.innerHTML = "";
    emptyEl.style.display = "none";
    countEl.textContent = "";

    if (!input.trim()) {
      countEl.textContent = "Paste the message first.";
      return;
    }

    var scored = CATEGORIES.map(function (cat) {
      var s = scoreCategory(cat, textLower);
      return { cat: cat, score: s.score, aliasHit: s.aliasHit };
    }).filter(function (r) { return r.score > 0; });

    scored.sort(function (a, b) { return b.score - a.score; });

    var top = scored.slice(0, 3);

    if (top.length === 0) {
      emptyEl.style.display = "block";
      countEl.textContent = "";
      return;
    }

    countEl.textContent = top.length === 1
      ? "1 likely match:"
      : top.length + " possible matches, most likely first:";

    top.forEach(function (r) {
      var div = document.createElement("div");
      div.className = "rd-match";
      var guidelineLine = r.cat.guideline && r.cat.guideline !== "—"
        ? "Guideline " + r.cat.guideline
        : "No specific guideline number, common pattern";
      div.innerHTML =
        '<div class="rd-guideline">' + guidelineLine + '</div>' +
        "<h3>" + r.cat.title + "</h3>" +
        '<p><span class="rd-label">What this usually means: </span>' + r.cat.explain + "</p>" +
        '<p><span class="rd-label">What to actually do: </span>' + r.cat.fix + "</p>";
      resultsEl.appendChild(div);
    });
  }

  function wireUp() {
    var btn = document.getElementById("rdBtn");
    if (btn) btn.addEventListener("click", diagnose);
    var input = document.getElementById("rdInput");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") diagnose();
      });
    }
  }

  // Defensive against a DOMContentLoaded race: if the script happens to run
  // after the event already fired (can happen depending on load timing),
  // waiting on the event alone means it never fires again and the button
  // silently does nothing. Wire up immediately if the DOM is already ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp);
  } else {
    wireUp();
  }
})();
