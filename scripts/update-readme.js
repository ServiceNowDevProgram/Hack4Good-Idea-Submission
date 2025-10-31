#!/usr/bin/env node
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

const FOCUS_MAP = {
    cure: "🧪 Cause and Cure",
    disaster: "🆘 Disaster and Community Support",
    education: "🎓 Education and Youth Services",
    sustainability: "🌱 Sustainability and Decarbonization",
    other: "🧩 Other",
}

// Matches any folder depth to the update path in scope
const GLOB_PATTERN = "**/update/x_snc_hack4good_0_hack4good_proposal_*.xml";

const repoFull = process.env.GITHUB_REPOSITORY || "";
const [OWNER, REPO] = repoFull.split("/");

// Octokit (uses the ephemeral GITHUB_TOKEN in Actions)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
  userAgent: "hack4good-readme-bot"
});

// --- utilities

function friendlyFocus(value) {
  if (!value) return "—";
  const key = String(value).trim().toLowerCase();
  return FOCUS_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
}

function loadCache() {
  try {
    if (fs.existsSync(ATTR_CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(ATTR_CACHE_PATH, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(ATTR_CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

function readReadme() {
  if (fs.existsSync(README_PATH)) return fs.readFileSync(README_PATH, "utf-8");
  return "# Hack4Good\n\n";
}

// Extract simple children safely from parsed XML
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
      allowBooleanAttributes: true
    });
    const root = parser.parse(xml);

    // Navigate to <record_update><x_snc_hack4good_0_hack4good_proposal>...
    const record =
      root?.record_update?.x_snc_hack4good_0_hack4good_proposal ||
      root?.x_snc_hack4good_0_hack4good_proposal;

    if (!record) return null;

    const projectName = firstText(record, "project_name");
    if (!projectName) return null;

    const focusArea = friendlyFocus(firstText(record, "focus_area"));
    const createdRaw = firstText(record, "sys_created_on");
    const createdDt = createdRaw ? new Date(createdRaw.replace(" ", "T") + "Z") : null;

    return {
      project_name: projectName,
      focus_area: focusArea,
      created_dt: createdDt,       // Date | null
      created_raw: createdRaw,     // original string
      path: filePath
    };
  } catch (e) {
    console.error(`WARNING: Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

// Get first commit that added the file (like git log --diff-filter=A)
async function firstAddingCommitSha(filePath) {
  // Use `git log` via child_process to avoid extra deps
  // (Actions runners have git)
  const { spawnSync } = await import("child_process");
  const out = spawnSync("git", ["log", "--diff-filter=A", "--format=%H", "--", filePath], {
    encoding: "utf-8"
  });
  if (out.status !== 0) return null;
  const lines = out.stdout.trim().split("\n").filter(Boolean);
  return lines[0] || null;
}

// Resolve PR author for a commit; fallback to commit author
async function resolveAttributionForCommit(commitSha) {
  if (!commitSha || !OWNER || !REPO) return null;

  try {
    // Preferred: list PRs associated with a commit
    const pulls = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}/pulls", {
      owner: OWNER,
      repo: REPO,
      ref: commitSha,
      mediaType: { format: "json" }
    });

    if (Array.isArray(pulls.data) && pulls.data.length) {
      const pr = pulls.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
      const user = pr.user || {};
      return {
        login: user.login || null,
        avatar_url: user.avatar_url ? `${user.avatar_url}&s=40` : "",
        html_url: user.html_url || ""
      };
    }
  } catch (e) {
    // fall through to commit author
  }

  try {
    const commit = await octokit.repos.getCommit({ owner: OWNER, repo: REPO, ref: commitSha });
    const authorUser = commit.data.author; // linked GitHub user if available
    if (authorUser) {
      return {
        login: authorUser.login || null,
        avatar_url: authorUser.avatar_url ? `${authorUser.avatar_url}&s=40` : "",
        html_url: authorUser.html_url || ""
      };
    }
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
    const img = avatar
      ? `<img src="${avatar}" width="20" height="20" alt="@${login}"/>`
      : "";
    // Compact inline: avatar then @handle, all inside one link
    return `<a href="${url}">${img} @${login}</a>`;
  }
  return `@${login}`;
}

function replaceBetweenMarkers(readmeText, newBlock) {
  if (!readmeText.includes(MARKER_START) || !readmeText.includes(MARKER_END)) {
    return (
      readmeText.trimEnd() +
      `

${MARKER_START}

_Updated automatically on merge to \`main\`._

${newBlock}
${MARKER_END}
`
    );
  }
  const pattern = new RegExp(
    `(${escapeRegExp(MARKER_START)})([\\s\\S]*?)(${escapeRegExp(MARKER_END)})`,
    "m"
  );
  const replacement = `$1

_Updated automatically on merge to \`main\`._
${newBlock}$3`;
  return readmeText.replace(pattern, replacement);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildTable(items) {
  if (!items.length) {
    return "\n_No ideas yet. Be the first to submit one!_\n";
  }

  const cache = loadCache();
  const rows = [];

  try {
    for (const it of items) {
      const project = `[${it.project_name}](${it.path})`;
      const focus = it.focus_area;
      const key = it.path;

      let attr = cache[key];
      if (!attr || !attr.login) {
        const sha = await firstAddingCommitSha(it.path);
        attr = await resolveAttributionForCommit(sha);
        cache[key] = attr || { login: "Unknown", avatar_url: "", html_url: "" };
      }

      const submitter = renderSubmitterCell(cache[key]);
      const created = it.created_dt
        ? it.created_dt.toISOString().slice(0, 10)
        : "—";

      rows.push(`| ${project} | ${focus} | ${submitter} | ${created} |`);
    }
  } finally {
    saveCache(cache);
  }

  const header =
    "| Project | Focus area | Submitted by | Created (UTC) |\n|---|---|---|---|\n";
  return "\n" + header + rows.join("\n") + "\n";
}

async function main() {
  // 1) Find XMLs
  const files = await fg(GLOB_PATTERN, { dot: true, onlyFiles: true });
  const items = [];

  for (const f of files) {
    const rec = parseXmlFile(f);
    if (rec) items.push(rec);
  }

  // 2) Sort newest first (entries with no date sink)
  items.sort((a, b) => {
    const av = a.created_dt ? a.created_dt.getTime() : -Infinity;
    const bv = b.created_dt ? b.created_dt.getTime() : -Infinity;
    return bv - av;
  });

  // 3) Build table (Markdown)
  const tableMd = await buildTable(items);

  // 4) Inject into README
  const readme = readReadme();
  const updated = replaceBetweenMarkers(readme, tableMd);

  if (updated !== readme) {
    fs.writeFileSync(README_PATH, updated, "utf-8");
    console.log("README.md updated.");
  } else {
    console.log("README.md unchanged.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
