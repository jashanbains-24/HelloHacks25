// src/pages/Home.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import TopBar from "../components/TopBar.jsx";
import { supabase } from "../SupaBaseClient";

export default function Home() {
  const [zoomSide, setZoomSide] = useState(null); // 'left' | 'right' | null
  const inputRef = useRef(null);

  // ---------- helpers ----------
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
  const lc = (arr) => arr.map((x) => String(x).toLowerCase().trim());
  const coverageColor = (coverage) => {
    const hue = Math.max(0, Math.min(120, Math.round(coverage * 120))); // 0=red, 120=green
    return `hsl(${hue}, 85%, 50%)`;
  };
  const normCode = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""); // ignore spaces/dashes

  // ---------- Profile-saved data ----------
  const [profileSkills, setProfileSkills] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("profileSkills");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setProfileSkills(parsed);
    } catch {}
  }, []);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "profileSkills") {
        try { setProfileSkills(e.newValue ? JSON.parse(e.newValue) : []); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getSavedCourseCodes = () => {
    const tryKeys = ["profileCourseCodes", "completedCourseCodes", "profileCourses"];
    for (const k of tryKeys) {
      try {
        const raw = localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  };

  // ---------- LEFT (Employment) ----------
  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [jobSkills, setJobSkills] = useState([]);
  const [matchedCourses, setMatchedCourses] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [errJobs, setErrJobs] = useState("");

  async function onSearchCompany(e) {
    e?.preventDefault();
    setJobs([]); setJobId(""); setJobSkills([]); setMatchedCourses([]);
    await fetchJobs(company);
  }

  async function fetchJobs(query) {
    const q = (query || "").trim();
    if (!q) { setJobs([]); setErrJobs(""); return; }

    setLoadingJobs(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .or(`company.ilike.%${q}%,title.ilike.%${q}%`)
      .order("id", { ascending: true });

    setLoadingJobs(false);
    if (error) setErrJobs(error.message);
    else { setErrJobs(""); setJobs(data || []); }
  }

  // Debounced type-to-search for Employment
  useEffect(() => {
    if (zoomSide !== "left") return;
    const t = setTimeout(() => { fetchJobs(company); }, 300);
    return () => clearTimeout(t);
  }, [company, zoomSide]);

  // Load skills + course recs when a job card is selected (Employment)
  useEffect(() => {
    const run = async () => {
      const job = jobs.find((j) => String(j.id) === String(jobId));
      if (!job) { setJobSkills([]); setMatchedCourses([]); return; }

      const raw = job["skills-req"] !== undefined ? job["skills-req"] : job.skills_req;
      const ks = toArray(raw);
      setJobSkills(ks);

      if (!ks.length) { setMatchedCourses([]); return; }

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

  const selectedJob = useMemo(
    () => jobs.find(j => String(j.id) === String(jobId)),
    [jobs, jobId]
  );

  // Employment progress from Profile
  const profileLC = lc(profileSkills);
  const needLC_emp = lc(jobSkills);
  const haveLC_emp = needLC_emp.filter(s => profileLC.includes(s));
  const progress_emp = needLC_emp.length ? haveLC_emp.length / needLC_emp.length : 0;
  const progressPct_emp = Math.round(progress_emp * 100);

  // ---------- RIGHT (Skills or Courses) ----------
  const [courseInput, setCourseInput] = useState("");
  const [yourSkills, setYourSkills] = useState([]);      // derived from entered courses + typed skills OR saved set
  const [jobMatches, setJobMatches] = useState([]);      // [{id,title,company,matched,needed,coverage}]
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [errSkills, setErrSkills] = useState("");
  const [matchJobId, setMatchJobId] = useState("");      // selected job on right side

  const rankJobsFromSkills = async (skills) => {
    const { data: allJobs, error: jErr } = await supabase.from("jobs").select("*");
    if (jErr) throw new Error(jErr.message);

    const yourLC = lc(skills);
    return (allJobs || [])
      .map(j => {
        const raw = j["skills-req"] !== undefined ? j["skills-req"] : j.skills_req;
        const need = toArray(raw);
        const needLC = lc(need);
        const matchedLC = needLC.filter(s => yourLC.includes(s));
        const coverage = needLC.length ? matchedLC.length / needLC.length : 0;
        const matchedPretty = need.filter(s => matchedLC.includes(String(s).toLowerCase().trim()));
        return { id: j.id, title: j.title, company: j.company, matched: matchedPretty, needed: need, coverage };
      })
      .filter(r => r.matched.length > 0)
      .sort((a, b) => {
        if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
        if ((b.coverage || 0) !== (a.coverage || 0)) return (b.coverage || 0) - (a.coverage || 0);
        return String(a.title).localeCompare(String(b.title));
      });
  };

  async function onFindJobsFromCourses(e) {
    e?.preventDefault();
    setErrSkills(""); setMatchJobId("");

    const tokens = courseInput.split(",").map(s => s.trim()).filter(Boolean);
    if (!tokens.length) { setYourSkills([]); setJobMatches([]); return; }

    setLoadingSkills(true);
    try {
      const { data: allCourses, error: cErr } = await supabase.from("courses").select("*");
      if (cErr) throw new Error(cErr.message);

      const tokenNorms = tokens.map(normCode);
      const pickedCourses = (allCourses || []).filter(c => tokenNorms.includes(normCode(c.code)));

      const courseCodeSet = new Set((allCourses || []).map(c => normCode(c.code)));
      const skillSet = new Set();
      pickedCourses.forEach(c => toArray(c.skills).forEach(s => skillSet.add(s)));
      tokens.forEach(tok => { if (!courseCodeSet.has(normCode(tok))) skillSet.add(tok); });

      const yourKs = Array.from(skillSet);
      setYourSkills(yourKs);

      const ranked = await rankJobsFromSkills(yourKs);
      setJobMatches(ranked);
    } catch (err) {
      setErrSkills(err.message || "Failed to find jobs from courses/skills.");
      setJobMatches([]);
    } finally {
      setLoadingSkills(false);
    }
  }

  async function onUseSavedSkillsAndCourses() {
    setErrSkills(""); setMatchJobId("");
    setLoadingSkills(true);
    try {
      const savedSkills = Array.isArray(profileSkills) ? profileSkills : [];
      const savedCodes = getSavedCourseCodes();
      let allSkills = new Set(savedSkills);

      if (savedCodes.length) {
        const { data: allCourses, error: cErr } = await supabase.from("courses").select("*");
        if (cErr) throw new Error(cErr.message);
        const codeNorms = new Set(savedCodes.map(normCode));
        const picked = (allCourses || []).filter(c => codeNorms.has(normCode(c.code)));
        picked.forEach(c => toArray(c.skills).forEach(s => allSkills.add(s)));
      }

      const finalSkills = Array.from(allSkills);
      setYourSkills(finalSkills);

      const ranked = await rankJobsFromSkills(finalSkills);
      setJobMatches(ranked);
    } catch (err) {
      setErrSkills(err.message || "Failed to use saved skills/courses.");
      setJobMatches([]);
    } finally {
      setLoadingSkills(false);
    }
  }

  const selectedMatchJob = useMemo(
    () => jobMatches.find(j => String(j.id) === String(matchJobId)),
    [jobMatches, matchJobId]
  );

  const yourLC_right = lc(yourSkills);
  const needLC_right = lc(selectedMatchJob?.needed || []);
  const haveLC_right = needLC_right.filter(s => yourLC_right.includes(s));
  const progress_right = needLC_right.length ? haveLC_right.length / needLC_right.length : 0;
  const progressPct_right = Math.round(progress_right * 100);

  // ---------- diagonal UI behavior ----------
  const chooseSide = (side) => {
    setZoomSide(side);
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160);
  };
  const switchSide = () => {
    setZoomSide((s) => (s === "left" ? "right" : "left"));
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160);
  };

  const centerTitle = zoomSide === "right" ? "Skills or Courses" : "Employment";
  const centerSub =
    zoomSide === "right"
      ? "Discover training programs and skill-based paths to enhance your career development."
      : "Find opportunities based on job titles, industries, and roles that fit your experience and goals.";
  const inputPlaceholder =
    zoomSide === "right" ? "Enter course codes or skills…" : "Search job title or company…";
  const switchLabel =
    zoomSide === "right" ? "← Switch to Employment" : "Switch to Skills or Courses →";

  const inputValue = zoomSide === "right" ? courseInput : company;
  const onInputChange = (e) => {
    if (zoomSide === "right") setCourseInput(e.target.value);
    else setCompany(e.target.value);
  };
  const onSubmit = (e) => {
    if (zoomSide === "right") onFindJobsFromCourses(e);
    else onSearchCompany(e);
  };

  return (
    <>
      <TopBar />

      <main className={`viewport ${zoomSide ? `zoom-${zoomSide}` : ""}`} aria-label="Diagonal split landing">
        {/* clickable diagonal panels */}
        <a className="panel panel--left" href="#" onClick={(e) => { e.preventDefault(); chooseSide("left"); }}>
          <div className="content">
            <span className="eyebrow">Search by</span>
            <h1>Employment</h1>
            <p className="sub">Find opportunities based on job titles, industries, and roles that fit your experience and goals.</p>
          </div>
        </a>

        <a className="panel panel--right" href="#" onClick={(e) => { e.preventDefault(); chooseSide("right"); }}>
          <div className="content">
            <span className="eyebrow">Search by</span>
            <h1><span style={{ display: "block" }}>Skills</span><span style={{ display: "block" }}>or Courses</span></h1>
            <p className="sub">Discover training programs and skill-based paths to enhance your career development.</p>
          </div>
        </a>

        {/* center content */}
        <div className={`center-content ${zoomSide === "left" ? "left-anchored" : ""}`}>
          <div className="text-content">
            <h1 id="centerTitle">{centerTitle}</h1>
            <p id="centerSub">{centerSub}</p>
          </div>

          {/* SEARCH BAR — shared */}
          <form className="search-bar" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="search"
              id="searchInput"
              placeholder={inputPlaceholder}
              value={inputValue}
              onChange={onInputChange}
            />
            <button id="searchButton" type="submit">{zoomSide === "right" ? "Find jobs" : "Search"}</button>
          </form>

          {/* Buttons under search */}
          {zoomSide === "right" ? (
            <div className="search-actions">
              <button className="switch-btn switch-inline centered" type="button" onClick={switchSide}>
                {switchLabel}
              </button>
              <button className="btn-secondary centered" type="button" onClick={onUseSavedSkillsAndCourses}>
                Use saved skills & courses
              </button>
            </div>
          ) : zoomSide === "left" ? (
            <div className="search-actions">
              <button className="switch-btn switch-inline centered" type="button" onClick={switchSide}>
                {switchLabel /* “Switch to Skills or Courses →” */ }
              </button>
            </div>
          ) : null}

          {/* ---------- RESULTS (Employment: LEFT) ---------- */}
          {zoomSide === "left" && (
            <div className={`left-split ${jobId ? "" : "onecol"}`}>
              {/* LEFT COLUMN: stacked job results */}
              <div className="left-col">
                {loadingJobs && <div className="muted">Loading jobs…</div>}
                {errJobs && <div className="error">{errJobs}</div>}

                {jobs.length > 0 ? (
                  <div className="card glass">
                    <div className="card-head">
                      <h3 className="card-title">Jobs</h3>
                      <span className="meta">click a job to see details</span>
                    </div>

                    <ul className="card-list">
                      {jobs.map((j) => {
                        const selected = String(j.id) === String(jobId);
                        return (
                          <li key={j.id}>
                            <button
                              type="button"
                              className={`job-row${selected ? " selected" : ""}`}
                              onClick={() => setJobId(j.id)}
                              aria-pressed={selected}
                            >
                              <div className="job-main">
                                <div className="job-title">{j.title}</div>
                                {j.company && <div className="job-company">@ {j.company}</div>}
                              </div>
                              <span className="job-chevron" aria-hidden="true">›</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  company.trim().length > 0 && !loadingJobs && !errJobs && (
                    <div className="card glass">
                      <div className="card-head">
                        <h3 className="card-title">Jobs</h3>
                      </div>
                      <div className="muted">No jobs found for “{company}”. Try a different company or title.</div>
                    </div>
                  )
                )}
                {/* spacer to guarantee 1-card empty space */}
                <div className="end-spacer" aria-hidden="true" />
              </div>

              {/* RIGHT COLUMN: details (Employment) */}
              {jobId && (
                <div className="right-col">
                  <div className="card glass details-card">
                    <div className="details-top">
                      <div className="details-title">
                        {selectedJob?.title}
                        {selectedJob?.company && <span className="muted"> @ {selectedJob.company}</span>}
                      </div>
                    </div>

                    {/* Progress (Profile) */}
                    <section className="details-section">
                      <div className="row between">
                        <h4 className="section-title">Your progress</h4>
                        <span className="pill soft">{progressPct_emp}%</span>
                      </div>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${progressPct_emp}%`, background: coverageColor(progress_emp) }} />
                      </div>
                      {haveLC_emp.length > 0 && (
                        <div className="muted small" style={{ marginTop: 8 }}>
                          you have: {haveLC_emp.join(", ")}
                        </div>
                      )}
                    </section>

                    {/* Required skills */}
                    <section className="details-section">
                      <h4 className="section-title">Required skills</h4>
                      {jobSkills.length ? (
                        <div className="chip-row">
                          {jobSkills.map((s, i) => {
                            const hasIt = profileLC.includes(String(s).toLowerCase().trim());
                            return <span key={i} className={`chip${hasIt ? " chip--have" : ""}`}>{s}</span>;
                          })}
                        </div>
                      ) : (
                        <div className="muted">No skills listed.</div>
                      )}
                    </section>

                    {/* Recommended courses */}
                    <section className="details-section">
                      <div className="row between">
                        <h4 className="section-title">Recommended UBC courses</h4>
                        <span className="meta">(by overlap)</span>
                      </div>
                      {matchedCourses.length ? (
                        <ul className="list-unstyled divided">
                          {matchedCourses.map((c) => (
                            <li key={c.id} className="row between">
                              <div>
                                <b>{c.code}</b> — {c.name}
                                {c.matchCount > 0 && (
                                  <span className="muted"> &nbsp;• matches: {c.matched.join(", ")}</span>
                                )}
                              </div>
                              <span className="pill soft">{c.matchCount}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="muted">No course recommendations yet.</div>
                      )}
                    </section>
                  </div>
                  {/* spacer to guarantee 1-card empty space */}
                  <div className="end-spacer" aria-hidden="true" />
                </div>
              )}
            </div>
          )}

          {/* ---------- RESULTS (Skills / Courses: RIGHT) ---------- */}
          {zoomSide === "right" && (
            <div className={`right-split ${matchJobId ? "" : "onecol"}`}>
              {/* LEFT COLUMN: SINGLE SCROLLABLE CARD with "Your skills" + "Jobs you match" */}
              <div className="left-col">
                {loadingSkills && <div className="muted">Crunching skills…</div>}
                {errSkills && <div className="error">{errSkills}</div>}

                <div className="card glass scroll-card">
                  <div className="card-head">
                    <h3 className="card-title">Your skills & job matches</h3>
                  </div>

                  {/* Your skills */}
                  {!!yourSkills.length ? (
                    <>
                      <div className="chip-row">
                        {yourSkills.map((s, i) => <span key={i} className="chip">{s}</span>)}
                      </div>
                      <div className="divider" />
                    </>
                  ) : (
                    <div className="muted">Enter course codes and/or skills above, or click “Use saved skills & courses”.</div>
                  )}

                  {/* Jobs you match (clickable rows) */}
                  {jobMatches.length ? (
                    <ul className="card-list">
                      {jobMatches.map((j) => {
                        const pct = Math.round((j.coverage || 0) * 100);
                        const color = coverageColor(j.coverage || 0);
                        const selected = String(j.id) === String(matchJobId);
                        return (
                          <li key={j.id}>
                            <button
                              type="button"
                              className={`job-row${selected ? " selected" : ""}`}
                              onClick={() => setMatchJobId(j.id)}
                              aria-pressed={selected}
                              title={`Matches: ${j.matched.length} • Coverage: ${pct}%`}
                            >
                              <div className="job-main">
                                <div className="job-title">
                                  {j.title} {j.company ? <span className="muted">@ {j.company}</span> : null}
                                </div>
                                <div className="bar" aria-hidden="true">
                                  <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                                </div>
                              </div>
                              <span className="pill strong" style={{ background: color }}>{pct}%</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    !!yourSkills.length && <div className="muted">No matches found yet.</div>
                  )}

                  {/* bottom spacer inside scroll-card */}
                  <div className="scroll-spacer" aria-hidden="true" />
                </div>
              </div>

              {/* RIGHT COLUMN: job details (like Employment) */}
              {matchJobId && selectedMatchJob && (
                <div className="right-col">
                  <div className="card glass details-card">
                    <div className="details-top">
                      <div className="details-title">
                        {selectedMatchJob.title}
                        {selectedMatchJob.company && <span className="muted"> @ {selectedMatchJob.company}</span>}
                      </div>
                    </div>

                    {/* Progress (from entered/saved skills) */}
                    <section className="details-section">
                      <div className="row between">
                        <h4 className="section-title">Your progress</h4>
                        <span className="pill soft">{progressPct_right}%</span>
                      </div>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${progressPct_right}%`, background: coverageColor(progress_right) }} />
                      </div>
                      {haveLC_right.length > 0 && (
                        <div className="muted small" style={{ marginTop: 8 }}>
                          you have: {haveLC_right.join(", ")}
                        </div>
                      )}
                    </section>

                    {/* Required skills (full list; green = you have it) */}
                    <section className="details-section">
                      <h4 className="section-title">Required skills</h4>
                      {selectedMatchJob.needed?.length ? (
                        <div className="chip-row">
                          {selectedMatchJob.needed.map((s, i) => {
                            const hasIt = yourLC_right.includes(String(s).toLowerCase().trim());
                            return <span key={i} className={`chip${hasIt ? " chip--have" : ""}`}>{s}</span>;
                          })}
                        </div>
                      ) : (
                        <div className="muted">No skills listed.</div>
                      )}
                    </section>

                    {/* Matched subset (quick view) */}
                    {selectedMatchJob.matched?.length > 0 && (
                      <section className="details-section">
                        <h4 className="section-title">Matched skills</h4>
                        <div className="chip-row">
                          {selectedMatchJob.matched.map((s, i) => <span key={i} className="chip chip--have">{s}</span>)}
                        </div>
                      </section>
                    )}
                  </div>
                  {/* spacer to guarantee 1-card empty space */}
                  <div className="end-spacer" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --------- styles --------- */}
      <style>{`
:root {
  --bg-1: hsl(210 10% 8%);
  --fg-1: hsl(0 0% 98%);
  --muted: hsl(0 0% 75%);
  --left-grad-1: hsl(200 50% 25%);
  --left-grad-2: hsl(210 60% 40%);
  --right-grad-1: hsl(210 5% 15%);
  --right-grad-2: hsl(210 5% 25%);
  --glass: hsl(0 0% 100% / .06);
  --glass-2: hsl(0 0% 100% / .08);
  --border: hsl(0 0% 100% / .14);
  --shadow: 0 10px 30px hsl(0 0% 0% / .35);
  --ease: cubic-bezier(.22,1,.36,1);
  --topbar-h: 64px;

  /* scrolling tuneables */
  --scroll-max: min(74vh, calc(100vh - 260px)); /* generous scroll */
  --bottom-gap: 120px; /* “one card” worth of space at bottom */
}

html, body { height: 100%; overflow: hidden; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  color: var(--fg-1);
  background: var(--bg-1);
}

.viewport {
  position: fixed;
  top: var(--topbar-h); left: 0; right: 0; bottom: 0;
  overflow: hidden;
}
.panel {
  position: absolute; inset: 0;
  display: grid; text-decoration: none; color: inherit;
  transition: all 0.6s var(--ease);
  border-radius: 0;
}
.panel--left {
  clip-path: polygon(0 0, 100% 0, 0 100%);
  background: linear-gradient(135deg, var(--left-grad-1), var(--left-grad-2));
  justify-items: start; align-items: start; z-index: 2;
}
.panel--right {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  background: linear-gradient(135deg, var(--right-grad-1), var(--right-grad-2));
  justify-items: end; align-items: end; text-align: right; z-index: 1;
}
.zoom-left .panel--left, .zoom-right .panel--right {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  z-index: 3; transform: scale(1.02);
}

/* Hide both sides' intro copy once a side is chosen */
.zoom-left .panel .content,
.zoom-right .panel .content {
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms var(--ease);
}

.content {
  padding: clamp(24px, 6vw, 64px);
  display: grid; gap: clamp(6px, 1.2vw, 10px);
  max-width: min(56ch, 44vw);
  transition: opacity 0.5s var(--ease);
}
.eyebrow { letter-spacing: .18em; text-transform: uppercase; font-weight: 600; font-size: clamp(12px, 1.6vw, 14px); opacity: .8; }
h1 { font-weight: 800; line-height: 1.05; font-size: clamp(32px, 8vw, 72px); }
p.sub { font-weight: 300; font-size: clamp(14px, 2.2vw, 18px); color: var(--muted); }
.panel--left .content { text-align: left; }
.panel--right .content { text-align: right; }
.panel:hover { filter: brightness(1.1); }

.center-content {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(.9);
  opacity: 0; transition: all .5s var(--ease);
  text-align: center; display: grid; gap: 12px; z-index: 10;
  width: min(900px, 86vw);
}
.zoom-left .center-content, .zoom-right .center-content { opacity: 1; transform: translate(-50%, -50%) scale(1); }

/* Pull the center content slightly left in Employment mode */
.left-anchored {
  left: 45%;
  transform: translate(-55%, -50%) scale(1);
  width: min(980px, 90vw);
  text-align: left;
}
.left-anchored .text-content { text-align: left; }
.left-anchored .search-bar { margin-left: 0; }

/* ---- SEARCH BAR ---- */
.search-bar { display: flex; align-items: center; gap: 10px; background: var(--glass); border: 1px solid var(--border); border-radius: 16px; padding: 12px 16px; box-shadow: var(--shadow); width: min(640px, 70%); margin: 0 auto; }
.search-bar input { flex: 1; border: none; outline: none; background: transparent; color: var(--fg-1); font-size: 1rem; }
.search-bar button { border: 1px solid var(--border); background: hsl(210 18% 20%); color: var(--fg-1); font-weight: 700; padding: 10px 16px; border-radius: 12px; cursor: pointer; }

.search-actions {
  display: grid;
  gap: 8px;
  justify-items: center;
  margin-top: 8px;
}

/* Switch + Saved buttons */
.switch-btn.switch-inline{
  position: static;
  background: var(--glass);
  color: var(--fg-1);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  z-index: 10;
  width: fit-content;
}
.switch-btn.switch-inline.centered { display: inline-block; }

.btn-secondary{
  background: hsl(210 18% 18%);
  color: var(--fg-1);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}
.btn-secondary.centered{ display: inline-block; }

/* ---- Employment split layout ---- */
.left-split {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: start;
}
.left-split.onecol { grid-template-columns: 1fr; }

/* ---- Skills/Courses split layout ---- */
.right-split {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: start;
}
.right-split.onecol { grid-template-columns: 1fr; }

/* Make both columns scrollable with extra bottom space */
.left-split .left-col,
.left-split .right-col,
.right-split .left-col,
.right-split .right-col{
  max-height: var(--scroll-max);
  overflow-y: auto;
  padding-right: 6px; /* avoid scrollbar overlay on content */
  scroll-padding-bottom: var(--bottom-gap);
}

/* spacer div to guarantee “one card” empty room */
.end-spacer { height: var(--bottom-gap); }

/* card container */
.card.glass{
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
  text-align: left;
  width: 100%;
}
.card-head{ display:flex; align-items:center; gap:10px; justify-content: space-between; margin-bottom: 8px; }
.card-title{ font-size: 16px; font-weight: 800; margin: 0; }
.meta{ color: var(--muted); font-size: 12px; }

.divider{ height: 1px; background: var(--border); margin: 12px 0; }

/* Scrollable combined card (right side) */
.scroll-card{
  max-height: var(--scroll-max);
  overflow-y: auto;
  padding-right: 6px;
}
.scroll-card .scroll-spacer{ height: var(--bottom-gap); } /* inside-card spacer */

/* lists, chips, bars */
.card-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.job-row {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass);
  cursor: pointer;
  transition: transform 160ms var(--ease), border-color 160ms var(--ease), filter 160ms var(--ease);
}
.job-row:hover { filter: brightness(1.05); border-color: hsl(0 0% 100% / .24); transform: translateY(-1px); }
.job-row.selected { outline: 2px solid rgba(96,165,250,0.6); outline-offset: 2px; }
.job-main { display: grid; gap: 8px; text-align: left; }
.job-title { font-weight: 800; line-height: 1.25; }
.job-company { color: var(--muted); font-size: 0.95rem; }
.job-chevron { font-size: 22px; opacity: .6; }

.chip-row{ display:flex; flex-wrap: wrap; gap: 8px; }
.chip{
  padding: 6px 10px; border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--glass-2);
  font-size: 12px; color: var(--fg-1);
}
.chip.chip--have{
  border-color: hsl(140 60% 40%);
  background: hsl(140 60% 20% / .35);
  box-shadow: inset 0 0 0 1px hsl(140 60% 35% / .5);
}

.list-unstyled{ list-style: none; margin: 0; padding: 0; }
.divided > li + li{ border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; }
.row{ display:flex; gap:8px; }
.row.between{ justify-content: space-between; align-items: center; }
.pill{
  display:inline-flex; align-items:center; justify-content:center;
  min-width: 28px; height: 22px; padding: 0 8px;
  border-radius: 999px; border: 1px solid var(--border);
  background: var(--glass-2); color: var(--fg-1); font-weight: 800; font-size: 12px;
}
.pill.soft{ opacity: .9; }
.small{ font-size: 12px; }

.bar{ height: 8px; border-radius: 999px; background: hsl(210 8% 20%); overflow: hidden; }
.bar-fill{ height: 100%; transition: width 300ms ease; }

@media (max-width: 920px) {
  .left-split, .right-split { grid-template-columns: 1fr; }
  :root { --scroll-max: min(76vh, calc(100vh - 240px)); }
}
      `}</style>
    </>
  );
}
