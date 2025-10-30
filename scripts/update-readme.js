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
const BACKUP_PATH = "README_backup.md"; // 🆕 Backup feature

const FOCUS_MAP = {
    cure: "🧪 Cause and Cure",
    disaster: "🆘 Disaster and Community Support",
    education: "🎓 Education and Youth Services",
    sustainability: "🌱 Sustainability and Decarbonization",
    other: "🧩 Other",
};

const GLOB_PATTERN = "**/update/x_snc_hack4good_0_hack4good_proposal_*.xml";
const repoFull = process.env.GITHUB_REPOSITORY || "";
const [OWNER, REPO] = repoFull.split("/");

// Dry run flag (🆕)
const DRY_RUN = process.argv.includes("--dry-run");

// Octokit initialization
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
    userAgent: "hack4good-readme-bot"
});

// --- Utilities
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
        const record =
            root?.record_update?.x_snc_hack4good_0_hack4good_proposal ||
            root?.x_snc_hack4good_0_hack4good_proposal;

        if (!record) throw new Error("Missing record node");

        const projectName = firstText(record, "project_name");
        if (!projectName) throw new Error("Missing project_name");

        const focusArea = friendlyFocus(firstText(record, "focus_area"));
        const createdRaw = firstText(record, "sys_created_on");
        const createdDt = createdRaw ? new Date(createdRaw.replace(" ", "T") + "Z") : null;

        return {
            project_name: projectName,
            focus_area: focusArea,
            created_dt: createdDt,
            created_raw: createdRaw,
            path: filePath
        };
    } catch (e) {
        console.error(`⚠️ Failed to parse ${filePath}: ${e.message}`);
        return null;
    }
}

async function firstAddingCommitSha(filePath) {
    const { spawnSync } = await import("child_process");
    const out = spawnSync("git", ["log", "--diff-filter=A", "--format=%H", "--", filePath], {
        encoding: "utf-8"
    });
    if (out.status !== 0) return null;
    const lines = out.stdout.trim().split("\n").filter(Boolean);
    return lines[0] || null;
}

async function resolveAttributionForCommit(commitSha) {
    if (!commitSha || !OWNER || !REPO) return null;
    try {
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
    } catch (e) {}

    try {
        const commit = await octokit.repos.getCommit({ owner: OWNER, repo: REPO, ref: commitSha });
        const authorUser = commit.data.author;
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
        return `<a href="${url}">${img} @${login}</a>`;
    }
    return `@${login}`;
}

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
    const pattern = new RegExp(
        `(${escapeRegExp(MARKER_START)})([\\s\\S]*?)(${escapeRegExp(MARKER_END)})`,
        "m"
    );
    return readmeText.replace(pattern, `$1\n\n_Updated automatically on merge to \`main\`._\n${newBlock}$3`);
}

async function buildTable(items) {
    if (!items.length) return "\n_No ideas yet. Be the first to submit one!_\n";

    const cache = loadCache();
    const rows = [];
    const categoryCount = {}; // 🆕 For category summary

    try {
        for (const it of items) {
            const project = `[${it.project_name}](${it.path})`;
            const focus = it.focus_area;
            const key = it.path;

            categoryCount[focus] = (categoryCount[focus] || 0) + 1;

            let attr = cache[key];
            if (!attr || !attr.login) {
                const sha = await firstAddingCommitSha(it.path);
                attr = await resolveAttributionForCommit(sha);
                cache[key] = attr || { login: "Unknown", avatar_url: "", html_url: "" };
            }

            const submitter = renderSubmitterCell(cache[key]);
            const created = it.created_dt ? it.created_dt.toISOString().slice(0, 10) : "—";

            rows.push(`| ${project} | ${focus} | ${submitter} | ${created} |`);
        }
    } finally {
        saveCache(cache);
    }

    const summary = Object.entries(categoryCount)
        .map(([focus, count]) => `- ${focus}: **${count}**`)
        .join("\n");

    const header = "| Project | Focus area | Submitted by | Created (UTC) |\n|---|---|---|---|\n";
    return `\n### 📊 Summary\n${summary}\n\n${header}${rows.join("\n")}\n`;
}

async function main() {
    const start = Date.now(); // 🕓 Performance timer
    const files = await fg(GLOB_PATTERN, { dot: true, onlyFiles: true });
    const items = [];
    const failedFiles = []; // 🆕 Collect failed ones

    for (const f of files) {
        const rec = parseXmlFile(f);
        if (rec) items.push(rec);
        else failedFiles.push(f);
    }

    items.sort((a, b) => {
        const av = a.created_dt ? a.created_dt.getTime() : -Infinity;
        const bv = b.created_dt ? b.created_dt.getTime() : -Infinity;
        return bv - av;
    });

    const tableMd = await buildTable(items);
    const readme = readReadme();

    // 🆕 Backup old README
    if (fs.existsSync(README_PATH) && !DRY_RUN) {
        fs.copyFileSync(README_PATH, BACKUP_PATH);
        console.log(`🗂️  Backup saved: ${BACKUP_PATH}`);
    }

    const updated = replaceBetweenMarkers(readme, tableMd);

    if (DRY_RUN) {
        console.log("🧪 Dry-run mode: no files were changed.\n---\nPreview:\n");
        console.log(updated);
    } else if (updated !== readme) {
        fs.writeFileSync(README_PATH, updated, "utf-8");
        console.log("✅ README.md updated.");
    } else {
        console.log("ℹ️ README.md unchanged.");
    }

    // 🆕 Error summary and timing
    if (failedFiles.length) {
        console.log(`⚠️ ${failedFiles.length} XML files failed to parse:`);
        failedFiles.forEach(f => console.log("  - " + f));
    }
    console.log(`⏱️ Completed in ${(Date.now() - start) / 1000}s`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
