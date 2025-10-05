import { useEffect, useRef, useState, useMemo } from "react";
import TopBar from "../components/TopBar.jsx";
import { supabase } from "../SupaBaseClient";

export default function Home() {
  const [zoomSide, setZoomSide] = useState(null);
  const inputRef = useRef(null);

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
    const hue = Math.max(0, Math.min(120, Math.round(coverage * 120)));
    return `hsl(${hue}, 85%, 50%)`;
  };
  const normCode = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");

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

  useEffect(() => {
    if (zoomSide !== "left") return;
    const t = setTimeout(() => { fetchJobs(company); }, 300);
    return () => clearTimeout(t);
  }, [company, zoomSide]);

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

  const profileLC = lc(profileSkills);
  const needLC_emp = lc(jobSkills);
  const haveLC_emp = needLC_emp.filter(s => profileLC.includes(s));
  const progress_emp = needLC_emp.length ? haveLC_emp.length / needLC_emp.length : 0;
  const progressPct_emp = Math.round(progress_emp * 100);

  const [courseInput, setCourseInput] = useState("");
  const [yourSkills, setYourSkills] = useState([]);
  const [jobMatches, setJobMatches] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [errSkills, setErrSkills] = useState("");
  const [matchJobId, setMatchJobId] = useState("");

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

        <div className={`center-content ${zoomSide === "left" ? "left-anchored" : ""} ${zoomSide === "right" ? "right-anchored" : ""}`}>
          <div className="text-content">
            <h1 id="centerTitle">{centerTitle}</h1>
            <p id="centerSub">{centerSub}</p>
          </div>

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
                {switchLabel}
              </button>
            </div>
          ) : null}

          {zoomSide === "left" && (
            <div className={`left-split ${jobId ? "" : "onecol"}`}>
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
                <div className="end-spacer" aria-hidden="true" />
              </div>

              {jobId && (
                <div className="right-col">
                  <div className="card glass details-card">
                    <div className="details-top">
                      <div className="details-title">
                        {selectedJob?.title}
                        {selectedJob?.company && <span className="muted"> @ {selectedJob.company}</span>}
                      </div>
                    </div>

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
                  <div className="end-spacer" aria-hidden="true" />
                </div>
              )}
            </div>
          )}

          {zoomSide === "right" && (
            <div className={`right-split ${matchJobId ? "" : "onecol"}`}>
              <div className="left-col">
                {loadingSkills && <div className="muted">Crunching skills…</div>}
                {errSkills && <div className="error">{errSkills}</div>}

                <div className="card glass scroll-card">
                  <div className="card-head">
                    <h3 className="card-title">Your skills & job matches</h3>
                  </div>

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

                  <div className="scroll-spacer" aria-hidden="true" />
                </div>
              </div>

              {matchJobId && selectedMatchJob && (
                <div className="right-col">
                  <div className="card glass details-card">
                    <div className="details-top">
                      <div className="details-title">
                        {selectedMatchJob.title}
                        {selectedMatchJob.company && <span className="muted"> @ {selectedMatchJob.company}</span>}
                      </div>
                    </div>

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

                    {selectedMatchJob.matched?.length > 0 && (
                      <section className="details-section">
                        <h4 className="section-title">Matched skills</h4>
                        <div className="chip-row">
                          {selectedMatchJob.matched.map((s, i) => <span key={i} className="chip chip--have">{s}</span>)}
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="end-spacer" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style>{`
:root {
  --bg-1: hsl(210 10% 8%);
  --fg-1: hsl(0 0% 98%);
  --muted: hsl(0 0% 75%);
  --left-grad-1: hsla(0, 1%, 72%, 1.00);
  --left-grad-2: hsla(0, 0%, 44%, 1.00);
  --right-grad-1: hsl(210 5% 15%);
  --right-grad-2: hsl(210 5% 25%);
  --glass: hsl(0 0% 100% / .06);
  --glass-2: hsl(0 0% 100% / .08);
  --border: hsl(0 0% 100% / .14);
  --shadow: 0 10px 30px hsl(0 0% 0% / .35);
  --ease: cubic-bezier(.22,1,.36,1);
  --topbar-h: 64px;
  --scroll-max: min(74vh, calc(100vh - 260px));
  --bottom-gap: 120px;
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
  height: calc(100dvh - var(--topbar-h));
  background: var(--bg-1);
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
  transform: translate(-50%, -50%) scale(1);
  opacity: 0; transition: all .5s var(--ease);
  text-align: center; display: grid; gap: 12px; z-index: 10;
  width: min(1100px, 92vw);
}
.zoom-left .center-content, .zoom-right .center-content { opacity: 1; transform: translate(-50%, -50%) scale(1); }

.left-anchored {
  left: 45%;
  transform: translate(-55%, -50%) scale(1);
  width: min(980px, 90vw);
  text-align: left;
}
.left-anchored .text-content { text-align: left; }
.left-anchored .search-bar { margin-left: 0; }

.right-anchored {
  left: 55%;
  transform: translate(-45%, -50%) scale(1);
  width: min(1100px, 92vw);
  text-align: right;
}
.right-anchored .text-content { text-align: right; }
.right-anchored .search-bar { margin-left: auto; margin-right: 0; }


.search-bar { display: flex; align-items: center; gap: 10px; background: var(--glass); border: 1px solid var(--border); border-radius: 16px; padding: 12px 16px; box-shadow: var(--shadow); width: min(760px, 78%); margin: 0 auto; }
.search-bar input { flex: 1; border: none; outline: none; background: transparent; color: var(--fg-1); font-size: 1rem; }
.search-bar button { border: 1px solid var(--border); background: hsl(210 18% 20%); color: var(--fg-1); font-weight: 700; padding: 10px 16px; border-radius: 12px; cursor: pointer; }

.search-actions {
  display: grid;
  gap: 8px;
  justify-items: center;
  margin-top: 8px;
}

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

.left-split {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: start;
}
.left-split.onecol { grid-template-columns: 1fr; }

.right-split {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: start;
}
.right-split.onecol { grid-template-columns: 1fr; }

.left-split .left-col,
.left-split .right-col,
.right-split .left-col,
.right-split .right-col{
  max-height: var(--scroll-max);
  overflow-y: auto;
  padding-right: 6px;
  scroll-padding-bottom: var(--bottom-gap);
}

.end-spacer { height: var(--bottom-gap); }

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

.scroll-card{
  max-height: var(--scroll-max);
  overflow-y: auto;
  padding-right: 6px;
}
.scroll-card .scroll-spacer{ height: var(--bottom-gap); }

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
  :root { --scroll-max: min(78vh, calc(100vh - 220px));
          --bottom-gap: 96px; }
}

/* ============================= */
/* THEME OVERRIDES (colors only) */
/* ============================= */

/* LEFT / Employment: black text everywhere, white-ish surfaces, invert hover to black bg + white text */
.zoom-left .panel--left,
.zoom-left .left-anchored,
.zoom-left .left-split { color: #000; }

.zoom-left .left-anchored .text-content,
.zoom-left .left-split .card,
.zoom-left .left-split .card * { color: #000; }

.zoom-left .left-anchored .search-bar {
  background: rgba(255,255,255,.9);
  border-color: rgba(0,0,0,.18);
}
.zoom-left .left-anchored .search-bar input { color: #000; }
.zoom-left .left-anchored .search-bar ::placeholder { color: rgba(0,0,0,.6); }
.zoom-left .left-anchored .search-bar button {
  background: #111; color: #fff; border-color: #111;
}
.zoom-left .left-anchored .search-bar button:hover {
  background: #000; color: #fff; border-color: #000;
}

.zoom-left .left-split .card.glass {
  background: rgba(255,255,255,.9);
  border-color: rgba(0,0,0,.18);
}

.zoom-left .left-split .job-row {
  background: rgba(0,0,0,.06);
  border-color: rgba(0,0,0,.18);
  color: #000;
}
.zoom-left .left-split .job-row .job-company { color: rgba(0,0,0,.6); }
.zoom-left .left-split .job-row:hover {
  background: #000; color: #fff; border-color: #000;
}
.zoom-left .left-split .job-row.selected { outline-color: rgba(0,0,0,.7); }

.zoom-left .left-split .chip {
  background: rgba(0,0,0,.08);
  border-color: rgba(0,0,0,.18);
  color: #000;
}
.zoom-left .left-split .chip.chip--have{
  border-color: rgba(16,128,16,.7);
  background: rgba(16,128,16,.18);
  box-shadow: inset 0 0 0 1px rgba(16,128,16,.5);
  color: #000;
}
.zoom-left .left-split .chip:hover {
  background: #000; color: #fff; border-color: #000;
}

.zoom-left .left-split .pill {
  background: rgba(0,0,0,.08);
  border-color: rgba(0,0,0,.18);
  color: #000;
}
.zoom-left .left-split .pill:hover {
  background: #000; color: #fff; border-color: #000;
}

.zoom-left .left-split .muted { color: rgba(0,0,0,.65); }
.zoom-left .left-split .meta  { color: rgba(0,0,0,.55); }

/* RIGHT / Skills or Courses: force all text white, invert hover to white bg + black text */
.zoom-right .panel--right,
.zoom-right .right-anchored,
.zoom-right .right-split { color: #fff; }

.zoom-right .right-anchored .text-content,
.zoom-right .right-split .card,
.zoom-right .right-split .card * { color: #fff; }

.zoom-right .right-anchored .search-bar {
  background: var(--glass);
  border-color: var(--border);
}
.zoom-right .right-anchored .search-bar input { color: #fff; }
.zoom-right .right-anchored .search-bar ::placeholder { color: rgba(255,255,255,.8); }
.zoom-right .right-anchored .search-bar button { color: #fff; }
.zoom-right .right-anchored .search-bar button:hover {
  background: #fff; color: #000; border-color: #fff;
}

.zoom-right .right-split .card.glass {
  background: var(--glass);
  border-color: var(--border);
}

.zoom-right .right-split .job-row {
  background: var(--glass);
  border-color: var(--border);
  color: #fff;
}
.zoom-right .right-split .job-row .job-company { color: rgba(255,255,255,.8); }
.zoom-right .right-split .job-row:hover {
  background: #fff; color: #000; border-color: #fff;
}
.zoom-right .right-split .job-row.selected { outline-color: rgba(255,255,255,.7); }

.zoom-right .right-split .chip {
  background: var(--glass-2);
  border-color: var(--border);
  color: #fff;
}
.zoom-right .right-split .chip.chip--have{
  border-color: hsl(140 60% 70%);
  background: hsl(140 60% 35% / .35);
  box-shadow: inset 0 0 0 1px hsl(140 60% 75% / .5);
  color: #fff;
}
.zoom-right .right-split .chip:hover {
  background: #fff; color: #000; border-color: #fff;
}

.zoom-right .right-split .pill {
  background: var(--glass-2);
  border-color: var(--border);
  color: #fff;
}
.zoom-right .right-split .pill:hover {
  background: #fff; color: #000; border-color: #fff;
}

.zoom-right .right-split .muted { color: rgba(255,255,255,.85); }
.zoom-right .right-split .meta  { color: rgba(255,255,255,.8); }

.zoom-left .left-anchored .search-bar {
  background: var(--glass);
  border-color: var(--border);
}
.zoom-left .left-anchored .search-bar input { color: var(--fg-1); }
.zoom-left .left-anchored .search-bar ::placeholder { color: var(--muted); }
.zoom-left .left-anchored .search-bar button {
  background: hsl(210 18% 20%);
  color: var(--fg-1);
  border-color: var(--border);
}
.zoom-left .left-anchored .search-bar button:hover {
  background: #000; color: #fff; border-color: #000;
}

/* Selection color state = same as hover, and persists on hover */
.zoom-left .left-split .job-row.selected,
.zoom-left .left-split .job-row.selected:hover {
  background: #000; color: #fff; border-color: #000;
}
.zoom-left .left-split .job-row.selected .job-company,
.zoom-left .left-split .job-row.selected:hover .job-company {
  color: rgba(255,255,255,.85);
}

.zoom-right .right-split .job-row.selected,
.zoom-right .right-split .job-row.selected:hover {
  background: #fff; color: #000; border-color: #fff;
}
.zoom-right .right-split .job-row.selected .job-company,
.zoom-right .right-split .job-row.selected:hover .job-company {
  color: rgba(0,0,0,.7);
}

/* Align the action buttons with the side (left or right) */
.left-anchored .search-actions { justify-items: start; margin-left: 0; }
.right-anchored .search-actions { justify-items: end;   margin-right: 0; }

/* Make the buttons respect the side alignment (no forced centering) */
.left-anchored .switch-btn.switch-inline.centered,
.left-anchored .btn-secondary.centered { margin-left: 0; margin-right: auto; }

.right-anchored .switch-btn.switch-inline.centered,
.right-anchored .btn-secondary.centered { margin-left: auto; margin-right: 0; }

      `}</style>
    </>
  );
}
