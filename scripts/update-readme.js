#!/usr/bin/env node
/**
 * scripts/update-readme.js
 *
 * Upgraded README updater for Hack4Good ideation portal.
 *
 * Features:
 *  - Parses idea XMLs and extracts project_name, focus_area, description, impact, created date
 *  - Builds a Markdown table plus stats summary
 *  - Highlights new submissions (✨) since last run
 *  - Resolves attribution (PR author or commit author) via Octokit and caches results
 *  - Saves/read cache from .idea_attribution.json (backwards-compatible)
 *  - Backs up README.md before updating (README_backup.md)
 *  - Dry-run mode (--dry-run)
 *  - Error/parse summary + timing
 *  - Optional: fetch repo contributors and render their avatars
 *  - Optional: post a comment to a pull request if PR_NUMBER env var is set
 */

import fs from "fs";
import path from "path";
import process from "process";
import fg from "fast-glob";
import { XMLParser } from "fast-xml-parser";
import { Octokit } from "@octokit/rest";

const MARKER_START = "<!-- ideas:start -->";
const MARKER_END = "<!-- ideas:end -->";
const README_PATH = "README.md";
const ATTR_CACHE_PATH = ".idea_attribution.json";
const BACKUP_PATH = "README_backup.md";

const FOCUS_MAP = {
  cure: "🧪 Cause and Cure",
  disaster: "🆘 Disaster and Community Support",
  education: "🎓 Education and Youth Services",
  sustainability: "🌱 Sustainability and Decarbonization",
  other: "🧩 Other",
};

// glob pattern where ServiceNow exported XMLs live
const GLOB_PATTERN = "**/update/x_snc_hack4good_0_hack4good_proposal_*.xml";

const repoFull = process.env.GITHUB_REPOSITORY || "";
const [OWNER, REPO] = repoFull.split("/");

// Octokit - will be unauthenticated if no token provided (works for public repos only)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
  userAgent: "hack4good-readme-bot"
});

const DRY_RUN = process.argv.includes("--dry-run");
const PR_NUMBER = process.env.PR_NUMBER || process.env.GITHUB_PULL_REQUEST_NUMBER || null;

function friendlyFocus(value) {
  if (!value) return "—";
  const key = String(value).trim().toLowerCase();
  return FOCUS_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
}

function readReadme() {
  if (fs.existsSync(README_PATH)) return fs.readFileSync(README_PATH, "utf-8");
  return "# Hack4Good\n\n";
}

/**
 * Load cache in a backward-compatible way.
 * Old format might be a map { "path": { login:..., ... }, ... }
 * New format: { attrs: { ... }, meta: { seen: {...}, lastRun: ... } }
 */
function loadCacheFile() {
  try {
    if (!fs.existsSync(ATTR_CACHE_PATH)) return { attrs: {}, meta: { seen: {}, lastRun: null } };
    const raw = fs.readFileSync(ATTR_CACHE_PATH, "utf-8").trim();
    if (!raw) return { attrs: {}, meta: { seen: {}, lastRun: null } };
    const parsed = JSON.parse(raw);
    // detect format
    if (parsed && typeof parsed === "object" && (parsed.attrs || parsed.meta)) {
      // new format
      return {
        attrs: parsed.attrs || {},
        meta: parsed.meta || { seen: {}, lastRun: null }
      };
    } else {
      // old format: treat entire object as attrs
      return { attrs: parsed, meta: { seen: {}, lastRun: null } };
    }
  } catch (err) {
    console.error("⚠️ Failed to read cache, starting fresh:", err.message);
    return { attrs: {}, meta: { seen: {}, lastRun: null } };
  }
}

function saveCacheFile(attrs, meta) {
  const payload = { attrs: attrs || {}, meta: meta || { seen: {}, lastRun: null } };
  fs.writeFileSync(ATTR_CACHE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

/* --- XML parsing helper --- */
function firstText(obj, key) {
  if (!obj || typeof obj !== "object") return "";
  const v = obj[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseXmlFile(filePath) {
  try {
    const xml = fs.readFileSync(filePath, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      trimValues: true
    });
    const root = parser.parse(xml);

    const record =
      root?.record_update?.x_snc_hack4good_0_hack4good_proposal ||
      root?.x_snc_hack4good_0_hack4good_proposal;

    if (!record) throw new Error("Missing x_snc_hack4good_0_hack4good_proposal node");

    const projectName = firstText(record, "project_name");
    if (!projectName) throw new Error("Missing project_name");

    const focusArea = friendlyFocus(firstText(record, "focus_area"));
    const createdRaw = firstText(record, "sys_created_on");
    const createdDt = createdRaw ? new Date(createdRaw.replace(" ", "T") + "Z") : null;
    const description = firstText(record, "description") || firstText(record, "short_description") || "—";
    const impact = firstText(record, "impact_statement") || "—";

    return {
      project_name: projectName,
      focus_area: focusArea,
      description,
      impact,
      created_dt: createdDt,
      created_raw: createdRaw,
      path: filePath
    };
  } catch (e) {
    console.error(`⚠️ Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

/* --- Git attribution helpers --- */
async function firstAddingCommitSha(filePath) {
  // Use git available in Actions/CI environment
  try {
    const { spawnSync } = await import("child_process");
    const out = spawnSync("git", ["log", "--diff-filter=A", "--format=%H", "--", filePath], {
      encoding: "utf-8"
    });
    if (out.status !== 0) return null;
    const lines = out.stdout.trim().split("\n").filter(Boolean);
    return lines[0] || null;
  } catch {
    return null;
  }
}

async function resolveAttributionForCommit(commitSha) {
  if (!commitSha || !OWNER || !REPO) return null;

  try {
    // 1) Attempt: find PRs associated with commit
    const pulls = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}/pulls", {
      owner: OWNER,
      repo: REPO,
      ref: commitSha,
      mediaType: { format: "json" }
    });
    if (Array.isArray(pulls.data) && pulls.data.length) {
      // pick earliest PR
      const pr = pulls.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
      const user = pr.user || {};
      return {
        login: user.login || null,
        avatar_url: user.avatar_url ? `${user.avatar_url}&s=40` : "",
        html_url: user.html_url || ""
      };
    }
  } catch (e) {
    // ignore and fallback
  }

  try {
    // 2) Fallback: get commit details
    const commit = await octokit.repos.getCommit({ owner: OWNER, repo: REPO, ref: commitSha });
    const authorUser = commit.data.author; // linked GitHub user if available
    if (authorUser) {
      return {
        login: authorUser.login || null,
        avatar_url: authorUser.avatar_url ? `${authorUser.avatar_url}&s=40` : "",
        html_url: authorUser.html_url || ""
      };
    }
    // fallback to raw commit author
    const raw = commit.data.commit?.author || {};
    const login = raw.name || raw.email || "Unknown";
    return { login, avatar_url: "", html_url: "" };
  } catch {
    return null;
  }
}

function renderSubmitterCell(attr) {
  const login = attr?.login || "unknown";
  const url = attr?.html_url || "";
  const avatar = attr?.avatar_url || "";
  if (url) {
    const img = avatar ? `<img src="${avatar}" width="20" height="20" alt="@${login}" style="vertical-align:middle;border-radius:4px;margin-right:6px"/>` : "";
    return `<a href="${url}">${img}@${login}</a>`;
  }
  return `@${login}`;
}

/* --- Contributors render --- */
async function fetchAllContributors() {
  if (!OWNER || !REPO) return [];
  try {
    // octokit.paginate requires plugin but modern Octokit supports paginate
    const contributors = await octokit.paginate("GET /repos/{owner}/{repo}/contributors", {
      owner: OWNER,
      repo: REPO,
      per_page: 100
    });
    return contributors || [];
  } catch (e) {
    // if unauthenticated or API rate limit, gracefully return []
    return [];
  }
}

function renderContributorsMd(contributors) {
  if (!contributors || !contributors.length) return "";
  // render a compact row of avatars linked to profiles
  const items = contributors.map(c => {
    return `[<img src="${c.avatar_url}&s=60" width="60" height="60" alt="${c.login}" style="border-radius:8px"/>](${c.html_url})`;
  });
  return `### ❤️ Contributors\n\n${items.join(" ")}\n\n`;
}

/* --- Utilities for markdown and escaping --- */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceBetweenMarkers(readmeText, newBlock) {
  if (!readmeText.includes(MARKER_START) || !readmeText.includes(MARKER_END)) {
    return (
      readmeText.trimEnd() +
      `\n\n${MARKER_START}\n\n_Updated automatically on merge to \`main\`._\n\n${newBlock}\n${MARKER_END}\n`
    );
  }
  const pattern = new RegExp(`(${escapeRegExp(MARKER_START)})([\\s\\S]*?)(${escapeRegExp(MARKER_END)})`, "m");
  return readmeText.replace(pattern, `$1\n\n_Updated automatically on merge to \`main\`._\n${newBlock}$3`);
}

/* --- Build table and summary --- */
function truncate(text = "", limit = 120) {
  if (!text) return "—";
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trim() + "…";
}

async function buildTable(items) {
  if (!items.length) return "\n_No ideas yet. Be the first to submit one!_\n";

  const { attrs: cacheAttrs, meta } = loadCacheFile();
  const attrs = cacheAttrs || {};
  const seen = meta?.seen || {};
  const rows = [];
  const categoryCount = {};
  const newlySeen = []; // store keys newly seen in this run

  // We'll collect promises for attribution resolution in serial to not exceed rate limits too much
  for (const it of items) {
    const project = `[${it.project_name}](${it.path})`;
    const focus = it.focus_area;
    const key = it.path;

    categoryCount[focus] = (categoryCount[focus] || 0) + 1;

    let attr = attrs[key];
    const wasSeen = Boolean(seen[key] || (attr && attr.__seen));

    if (!attr || !attr.login) {
      // attempt to resolve attribution and cache
      const sha = await firstAddingCommitSha(key);
      const resolved = await resolveAttributionForCommit(sha);
      attr = resolved || { login: "Unknown", avatar_url: "", html_url: "" };
      // store into attrs
      attr.__resolved_from = sha || null;
      attrs[key] = attr;
    }

    // if wasn't seen before, mark as new
    const isNew = !wasSeen;
    if (isNew) {
      newlySeen.push(key);
      seen[key] = true;
      attrs[key].__seen = true;
    }

    const submitter = renderSubmitterCell(attrs[key]);
    const created = it.created_dt ? it.created_dt.toISOString().slice(0, 10) : "—";
    const desc = truncate(it.description, 110);
    const impact = truncate(it.impact, 70);

    // add ✨ marker for new submissions
    const protoProject = isNew ? `✨ ${project}` : project;

    rows.push(`| ${protoProject} | ${focus} | ${desc} | ${impact} | ${submitter} | ${created} |`);
  }

  // persist cache and meta with updated seen and lastRun
  const metaToSave = { seen, lastRun: new Date().toISOString() };
  saveCacheFile(attrs, metaToSave);

  // prepare summary
  const total = items.length;
  const focusEntries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  const topFocus = focusEntries[0] ? focusEntries[0][0] : "N/A";
  const newest = items[0]?.created_dt ? items[0].created_dt.toISOString().slice(0, 10) : "—";
  const oldest = items[items.length - 1]?.created_dt ? items[items.length - 1].created_dt.toISOString().slice(0, 10) : "—";

  const summaryLines = [
    `**Total Ideas:** ${total}`,
    `**Top Focus Area:** ${topFocus}`,
    `**Date Range:** ${oldest} → ${newest}`,
    `**New submissions this run:** ${newlySeen.length}`
  ];

  const summaryMd = `### 📊 Ideas Summary\n\n${summaryLines.join("  \n")}\n\n`;

  const header =
    "| Project | Focus area | Description | Impact | Submitted by | Created (UTC) |\n" +
    "|---|---|---|---|---|---|\n";

  return `\n${summaryMd}${header}${rows.join("\n")}\n`;
}

/* --- Optional: Comment on PR with summary --- */
async function postPrComment(prNumber, body) {
  if (!OWNER || !REPO || !prNumber) {
    console.log("ℹ️ PR comment skipped (missing OWNER/REPO/PR_NUMBER).");
    return;
  }
  try {
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: Number(prNumber),
      body
    });
    console.log(`💬 Commented on PR #${prNumber}`);
  } catch (e) {
    console.warn("⚠️ Failed to post PR comment:", e.message || e);
  }
}

/* --- Main --- */
async function main() {
  const t0 = Date.now();
  console.log("🔎 Searching for idea XML files...");
  const files = await fg(GLOB_PATTERN, { dot: true, onlyFiles: true });
  console.log(`Found ${files.length} files.`);

  const parsed = [];
  const failed = [];

  for (const f of files) {
    const rec = parseXmlFile(f);
    if (rec) parsed.push(rec);
    else failed.push(f);
  }

  // Sort newest first (fallback: missing dates sink to end)
  parsed.sort((a, b) => {
    const av = a.created_dt ? a.created_dt.getTime() : -Infinity;
    const bv = b.created_dt ? b.created_dt.getTime() : -Infinity;
    return bv - av;
  });

  // Build markdown table and summary
  const tableMd = await buildTable(parsed);

  // Optionally fetch contributors and prepend (best-effort)
  let contributorsMd = "";
  try {
    const contributors = await fetchAllContributors();
    contributorsMd = renderContributorsMd(contributors);
  } catch (e) {
    // ignore; contributors optional
  }

  // Prepend a header with project description and a link to ServiceNow instructions
  const headerBlock = `## A Special Partnership: Hack4Good

We are thrilled to announce that we are partnering with our friends at Hack4Good!

> This repository stores idea submissions for Hack4Good initiatives. You can import this application into a ServiceNow instance and submit ideas. Follow the CONTRIBUTING.md for guidelines.

${contributorsMd}
${tableMd}
`;

  // Inject into README
  const readme = readReadme();

  // Backup existing README if present and not dry-run
  if (!DRY_RUN && fs.existsSync(README_PATH)) {
    try {
      fs.copyFileSync(README_PATH, BACKUP_PATH);
      console.log(`🗂️ Backup saved to ${BACKUP_PATH}`);
    } catch (e) {
      console.warn("⚠️ Failed to create README backup:", e.message || e);
    }
  }

  const updated = replaceBetweenMarkers(readme, headerBlock);

  if (DRY_RUN) {
    console.log("🧪 Dry-run: no changes written. Preview follows:\n");
    console.log(updated);
  } else {
    if (updated !== readme) {
      fs.writeFileSync(README_PATH, updated, "utf-8");
      // append last updated timestamp (replace any previous trailing one)
      const lastUpdated = `\n_Last updated: ${new Date().toUTCString()}_\n`;
      // ensure we don't duplicate last updated: remove any existing trailing last-updated line
      let current = fs.readFileSync(README_PATH, "utf-8");
      current = current.replace(/\n_Last updated:[\s\S]*?_\n?$/, "");
      current = current.trimEnd() + "\n\n" + lastUpdated;
      fs.writeFileSync(README_PATH, current, "utf-8");
      console.log("✅ README.md updated.");
    } else {
      console.log("ℹ️ README.md unchanged.");
    }
  }

  // Print failed file summary and timing
  if (failed.length) {
    console.log(`⚠️ ${failed.length} files failed to parse:`);
    failed.forEach(f => console.log("  - " + f));
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(`⏱️ Completed in ${elapsed}s`);

  // Optionally: post a PR comment summarizing the run
  if (PR_NUMBER) {
    const comment = [
      `Automated README update by \`hack4good-readme-bot\`.`,
      "",
      `- files scanned: **${files.length}**`,
      `- ideas found: **${parsed.length}**`,
      `- parse failures: **${failed.length}**`,
      `- dry-run: **${DRY_RUN ? "yes" : "no"}**`,
      `- time: **${elapsed}s**`,
      "",
      `> If you want the README not to be updated, re-run with \`--dry-run\`.`
    ].join("\n");
    await postPrComment(PR_NUMBER, comment);
  }

  // Show possible GitHub Pages preview URL (best-effort)
  if (OWNER && REPO) {
    const siteUrl = `https://${OWNER}.github.io/${REPO}/`;
    console.log(`🌐 GitHub Pages preview (if enabled): ${siteUrl}`);
  }
}

/* --- Run --- */
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
