import TopBar from '../components/TopBar.jsx';

import { useEffect, useState } from "react";
import { supabase } from "../SupaBaseClient";


// ---------------- helpers ----------------
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const s = val.trim();
    try { if (s.startsWith("[")) return JSON.parse(s); } catch {}
    return s.replace(/[{}"]/g, "").split(",").map(x => x.trim()).filter(Boolean);
  }
  return [];
};
const lc = (arr) => arr.map((x) => x.toLowerCase().trim());
const fmtSkills = (arr) => Array.isArray(arr) ? arr.join(", ") : "";

// coverage (0..1) → color (red→amber→green)
const coverageColor = (coverage) => {
  const hue = Math.max(0, Math.min(120, Math.round(coverage * 120))); // 0=red, 120=green
  return `hsl(${hue}, 85%, 50%)`;
};
const coverageColorAlpha = (coverage, alpha = 0.18) => {
  const hue = Math.max(0, Math.min(120, Math.round(coverage * 120)));
  return `hsla(${hue}, 85%, 50%, ${alpha})`;
};

// ---------------- component ----------------
export default function App() {
  // SECTION 1 — company -> job -> skills + course recs
  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [jobSkills, setJobSkills] = useState([]);
  const [matchedCourses, setMatchedCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // SECTION 2 — courses -> your skills -> matching jobs
  const [courseInput, setCourseInput] = useState("");
  const [yourSkills, setYourSkills] = useState([]);
  const [jobMatches, setJobMatches] = useState([]);

  // ------- actions: Section 1 -------
  async function onSearchCompany(e) {
    e?.preventDefault();
    setErr(""); setJobs([]); setJobId(""); setJobSkills([]); setMatchedCourses([]);
    if (!company.trim()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .ilike("company", `%${company.trim()}%`)
      .order("id", { ascending: true });
    setLoading(false);

    if (error) setErr(error.message);
    else setJobs(data || []);
  }

  useEffect(() => {
    const run = async () => {
      const job = jobs.find((j) => String(j.id) === String(jobId));
      if (!job) { setJobSkills([]); setMatchedCourses([]); return; }

      // supports "skills-req" (hyphen) or skills_req (snake)
      const raw = job["skills-req"] !== undefined ? job["skills-req"] : job.skills_req;
      const ks = toArray(raw);
      setJobSkills(ks);

      if (!ks.length) { setMatchedCourses([]); return; }

      // client-side, case-insensitive overlap with courses
      const { data: courses, error } = await supabase.from("courses").select("*");
      if (error) { console.error(error); setMatchedCourses([]); return; }

      const jobLC = lc(ks);
      const results = (courses || [])
        .map(c => {
          const cSkills = toArray(c.skills);
          const cLC = lc(cSkills);
          const matched = cLC.filter(s => jobLC.includes(s));
          return { id: c.id, code: c.code, name: c.name, matched, matchCount: matched.length };
        })
        .filter(r => r.matchCount > 0)
        .sort((a,b) => b.matchCount - a.matchCount);

      setMatchedCourses(results);
    };
    run();
  }, [jobId, jobs]);

  // ------- actions: Section 2 -------
  async function onFindJobsFromCourses(e) {
    e?.preventDefault();
    setYourSkills([]); setJobMatches([]);

    const codes = courseInput.split(",").map(s => s.trim()).filter(Boolean);
    if (!codes.length) return;

    const { data: allCourses, error: cErr } = await supabase.from("courses").select("*");
    if (cErr) { alert(cErr.message); return; }

    const codesLC = lc(codes);
    const picked = (allCourses || []).filter(c => codesLC.includes(String(c.code).toLowerCase().trim()));

    const skillSet = new Set();
    picked.forEach(c => toArray(c.skills).forEach(s => skillSet.add(s)));
    const yourKs = Array.from(skillSet);
    setYourSkills(yourKs);

    const { data: allJobs, error: jErr } = await supabase.from("jobs").select("*");
    if (jErr) { alert(jErr.message); return; }

    const yourLC = lc(yourKs);
    const results = (allJobs || []).map(j => {
      const raw = j["skills-req"] !== undefined ? j["skills-req"] : j.skills_req;
      const need = toArray(raw);
      const needLC = lc(need);
      const matchedLC = needLC.filter(s => yourLC.includes(s));
      const coverage = needLC.length ? matchedLC.length / needLC.length : 0;
      const matchedPretty = need.filter(s => matchedLC.includes(s.toLowerCase().trim()));
      return { id: j.id, title: j.title, company: j.company, matched: matchedPretty, needed: need, coverage };
    })
    .filter(r => r.matched.length > 0)
    .sort((a,b) => b.coverage - a.coverage);

    setJobMatches(results);
  }

  // ---------------- UI ----------------
  return (
    
    <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#e8e8e8", background: "#1a1a1a", minHeight: "100vh" }}>
      {/* ======= SECTION 1 ======= */}
      <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 8 }}>
        Where do you want to work?
      </h1>
      <p style={{ color: "#9aa0a6", marginBottom: 16 }}>
        Pick a company → choose a job → see required skills and recommended UBC courses.
      </p>

      <form onSubmit={onSearchCompany} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company (e.g., Google)"
          style={{ flex: 1, padding: "12px 14px", border: "1px solid #333", borderRadius: 12, background: "#111", color: "#e8e8e8" }}
        />
        <button type="submit" style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: "#111", color: "#e8e8e8" }}>
          Search
        </button>
      </form>

      {loading && <div style={{ color: "#9aa0a6" }}>Loading jobs…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {!!jobs.length && (
        <div style={{ padding: 16, border: "1px solid #333", borderRadius: 16, marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Select job</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #333", background: "#111", color: "#e8e8e8" }}
          >
            <option value="">— Choose a job —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} {j.company ? `@ ${j.company}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {jobId && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Required skills</h3>
            {jobSkills.length ? (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                {jobSkills.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : (
              <div style={{ color: "#9aa0a6" }}>No skills listed.</div>
            )}
          </div>

          <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recommended UBC courses (by overlap)</h3>
            {matchedCourses.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                {matchedCourses.map((c) => (
                  <li key={c.id}>
                    <b>{c.code}</b> — {c.name}
                    {c.matchCount > 0 && (
                      <span style={{ color: "#9aa0a6" }}> (matches: {c.matched.join(", ")})</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#9aa0a6" }}>
                No course recommendations yet. Add courses with skills overlapping: <i>{fmtSkills(jobSkills)}</i>.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ margin: "32px 0", height: 1, background: "#333" }} />

      {/* ======= SECTION 2 ======= */}
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        What jobs am I ready for (based on my courses)?
      </h2>
      <p style={{ color: "#9aa0a6", marginBottom: 16 }}>
        Enter course codes (comma-separated). We’ll collect their skills and compare to jobs.
      </p>

      <form onSubmit={onFindJobsFromCourses} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          value={courseInput}
          onChange={(e) => setCourseInput(e.target.value)}
          placeholder="e.g., CPSC 210, DSCI 100"
          style={{ flex: 1, padding: "12px 14px", border: "1px solid #333", borderRadius: 12, background: "#111", color: "#e8e8e8" }}
        />
        <button type="submit" style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: "#111", color: "#e8e8e8" }}>
          Find jobs
        </button>
      </form>

      {/* your derived skills */}
      <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Your skills (from courses)</h3>
        {yourSkills.length ? fmtSkills(yourSkills) : (
          <span style={{ color: "#9aa0a6" }}>No skills yet — add valid course codes.</span>
        )}
      </div>

      {/* jobs you match — with gradient color & progress bar */}
      <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Jobs you match</h3>
        {jobMatches.length ? (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {jobMatches.map((j) => {
              const pct = Math.round(j.coverage * 100);
              const color = coverageColor(j.coverage);
              const tint = coverageColorAlpha(j.coverage);
              return (
                <li
                  key={j.id}
                  style={{
                    padding: "12px 14px",
                    marginBottom: 10,
                    borderRadius: 12,
                    border: "1px solid #2a2a2a",
                    background: tint,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>
                      {j.title} {j.company ? `@ ${j.company}` : ""}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color: "#0b0b0c",
                        background: color,
                        padding: "2px 10px",
                        borderRadius: 999,
                      }}
                      title={`${pct}% coverage`}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      height: 8,
                      borderRadius: 999,
                      background: "#2a2a2a",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>

                  {j.matched.length > 0 && (
                    <div style={{ marginTop: 8, color: "#c2c2c2" }}>
                      you match: {j.matched.join(", ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div style={{ color: "#9aa0a6" }}>
            No matches yet. Try different courses or add skills to your courses table.
          </div>
        )}
      </div>
    </div>
  );

}