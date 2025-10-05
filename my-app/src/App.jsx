import { useEffect, useState } from "react";
import { supabase } from "./SupaBaseClient";

export default function App() {
  // ---------------- shared helpers ----------------
  // Accepts text[], '["a","b"]', '{a,b}', 'a, b'
  const toArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      const s = val.trim();
      try {
        if (s.startsWith("[")) return JSON.parse(s); // JSON array
      } catch { /* ignore */ }
      return s.replace(/[{}"]/g, "").split(",").map(x => x.trim()).filter(Boolean);
    }
    return [];
  };
  const lc = (arr) => arr.map((x) => x.toLowerCase().trim());
  const fmtSkills = (arr) => Array.isArray(arr) ? arr.join(", ") : "";

  // ======================================================
  // SECTION 1 — Company → Job → Required skills + Course recs
  // ======================================================

  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [jobSkills, setJobSkills] = useState([]);
  const [matchedCourses, setMatchedCourses] = useState([]); // [{id, code, name, matched, matchCount}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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

      // Support skills-req (hyphen) or skills_req (snake)
      const raw = job["skills-req"] !== undefined ? job["skills-req"] : job.skills_req;
      const ks = toArray(raw);
      setJobSkills(ks);

      if (!ks.length) { setMatchedCourses([]); return; }

      // Client-side, case-insensitive course recommendations
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

  // ======================================================
  // SECTION 2 — Courses → (their skills) → Matching jobs
  // ======================================================

  const [courseInput, setCourseInput] = useState("");  // CSV: "CPSC 210, DSCI 100"
  const [yourSkills, setYourSkills] = useState([]);    // union of skills from selected courses
  const [jobMatches, setJobMatches] = useState([]);    // [{job, matched[], coverage, matchCount}]

  async function onFindJobsFromCourses(e) {
    e?.preventDefault();
    setYourSkills([]); setJobMatches([]);

    // Parse CSV of course codes, normalize whitespace/case
    const codes = courseInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!codes.length) return;

    // 1) Fetch all courses (hackathon scale) and match locally by code
    const { data: allCourses, error: cErr } = await supabase.from("courses").select("*");
    if (cErr) { alert(cErr.message); return; }

    // Match by case-insensitive equality on code
    const codesLC = lc(codes);
    const pickedCourses = (allCourses || []).filter(c => codesLC.includes(String(c.code).toLowerCase().trim()));

    // Gather union of skills from those courses
    const skillSet = new Set();
    pickedCourses.forEach(c => toArray(c.skills).forEach(s => skillSet.add(s)));
    const yourKs = Array.from(skillSet);
    setYourSkills(yourKs);

    // 2) Fetch all jobs and compute overlap
    const { data: allJobs, error: jErr } = await supabase.from("jobs").select("*");
    if (jErr) { alert(jErr.message); return; }

    const yourLC = lc(yourKs);

    const results = (allJobs || []).map(j => {
      const raw = j["skills-req"] !== undefined ? j["skills-req"] : j.skills_req;
      const need = toArray(raw);
      const needLC = lc(need);
      const matchedLC = needLC.filter(s => yourLC.includes(s));
      const coverage = needLC.length ? matchedLC.length / needLC.length : 0;

      // show original-case labels for matched list when possible
      const matchedPretty = need.filter(s => matchedLC.includes(s.toLowerCase().trim()));

      return {
        id: j.id,
        title: j.title,
        company: j.company,
        matched: matchedPretty,
        needed: need,
        coverage,                    // 0..1
        matchCount: matchedPretty.length
      };
    })
    .filter(r => r.matchCount > 0)             // only show jobs with at least one match
    .sort((a,b) => b.coverage - a.coverage);   // best coverage first

    setJobMatches(results);
  }

  // ---------------- UI ----------------
  return (
    <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#e8e8e8", background: "#1a1a1a", minHeight: "100vh" }}>
      {/* ========================================== */}
      {/* SECTION 1: Company → Job → Skills + Recs   */}
      {/* ========================================== */}
      <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 8 }}>
        Where do you want to work?
      </h1>
      <p style={{ color: "#9aa0a6", marginBottom: 16 }}>
        Type a company (e.g., <b>Google</b> or <b>Apple</b>) → pick a job → see required skills and recommended UBC courses.
      </p>

      {/* Company search */}
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

      {loading && <div>Loading jobs…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {!!jobs.length && (
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>Select job</label>
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
              <div style={{ color: "#9aa0a6" }}>No skills listed for this job.</div>
            )}
          </div>

          <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recommended UBC courses (by overlap)</h3>
            {matchedCourses.length ? (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
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

      {!loading && company && !jobs.length && (
        <div style={{ marginTop: 12, color: "#9aa0a6" }}>
          No jobs found for “{company}”. Try a different company.
        </div>
      )}

      {/* Divider */}
      <hr style={{ border: 0, borderTop: "1px solid #333", margin: "32px 0" }} />

      {/* ========================================== */}
      {/* SECTION 2: Courses → Skills → Matching Jobs */}
      {/* ========================================== */}
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        What jobs am I ready for (based on my courses)?
      </h2>
      <p style={{ color: "#9aa0a6", marginBottom: 16 }}>
        Enter your UBC courses (codes, comma-separated). We’ll pull their skills and compare to jobs.
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

      {/* show your derived skills */}
      <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Your skills (from courses)</h3>
        {yourSkills.length ? fmtSkills(yourSkills) : <span style={{ color: "#9aa0a6" }}>No skills yet — add valid course codes.</span>}
      </div>

      {/* matching jobs */}
      <div style={{ padding: 18, border: "1px solid #333", borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Jobs you match</h3>
        {jobMatches.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            {jobMatches.map(j => (
              <li key={j.id}>
                <b>{j.title}</b> {j.company ? `@ ${j.company}` : ""} —{" "}
                {Math.round(j.coverage * 100)}% coverage
                {j.matched.length > 0 && (
                  <span style={{ color: "#9aa0a6" }}> (you match: {j.matched.join(", ")})</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#9aa0a6" }}>No matches yet. Try different courses or add skills to your courses table.</div>
        )}
      </div>
    </div>
  );
}

