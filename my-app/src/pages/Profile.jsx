// src/pages/Profile.jsx
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import { supabase } from "../SupaBaseClient";
import "./Profile.css";

/* ---------------- helpers ---------------- */
const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-_]+/g, "");
const normCode = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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

/**
 * Locate the active user profile using `localStorage.activeUser`.
 * Searches window.FAKE_PROFILES (preferred) or localStorage.fake_profiles.
 * Returns the whole profile object or null.
 */
function getActiveProfile() {
  try {
    const usernameOrEmail = localStorage.getItem("activeUser") || "";
    if (!usernameOrEmail) return null;

    const fromGlobal = (typeof window !== "undefined" && window.FAKE_PROFILES) ? window.FAKE_PROFILES : null;
    const searchArr = Array.isArray(fromGlobal)
      ? fromGlobal
      : (() => {
          const raw = localStorage.getItem("fake_profiles");
          if (!raw) return null;
          try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : null; } catch { return null; }
        })();

    if (!Array.isArray(searchArr)) return null;

    const found = searchArr.find(p =>
      (p?.account?.username && String(p.account.username) === String(usernameOrEmail)) ||
      (p?.email && String(p.email) === String(usernameOrEmail))
    );
    return found || null;
  } catch {
    return null;
  }
}

const EMPLOYMENT_STATUSES = ["Unemployed", "Student", "Part-time", "Full-time", "Contractor", "Self-employed"];

export default function Profile() {
  const navigate = useNavigate();

  // ----- form state -----
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [age, setAge]             = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [location, setLocation]   = useState("");
  const [employment, setEmployment] = useState("");

  // ----- resume -----
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileNameOverride, setResumeFileNameOverride] = useState(""); // from profile.resumeFileName

  // ----- courses (DB) -----
  const [allCourses, setAllCourses] = useState([]);
  const [completedIds, setCompletedIds] = useState([]); // DB IDs
  const [searchCourse, setSearchCourse] = useState("");
  const [searchSkill, setSearchSkill]   = useState("");

  // Track if we already applied initial profile → fields to avoid re-overwriting after edits
  const [profileApplied, setProfileApplied] = useState(false);
  const [completedApplied, setCompletedApplied] = useState(false);

  // Fetch courses from Supabase
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("courses").select("*");
      if (!alive) return;
      if (error) {
        console.error(error.message || error);
        setAllCourses([]);
      } else {
        setAllCourses(data || []);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Normalize course fields
  const normalizedCourses = useMemo(() => {
    return (allCourses || []).map((c) => {
      const id = c.id;
      const code = c.code ?? c.Code ?? c.course_code ?? c.courseCode ?? c.title ?? c.name;
      const title = c.name ?? c.title ?? c.course_name ?? c.courseName ?? code;
      const skills = toArray(c.skills);
      return { id, code, title, skills };
    });
  }, [allCourses]);

  // Load profile once and prefill fields
  useEffect(() => {
    if (profileApplied) return;
    const prof = getActiveProfile();
    if (!prof) { setProfileApplied(true); return; }

    setFirstName(prof.firstName || "");
    setLastName(prof.lastName || "");
    setAge(String(prof.age ?? ""));
    setEmail(prof.email || "");
    setPhone(prof.phone || "");
    setLocation(prof.location || "");
    setEmployment(prof.employment || "");
    if (prof.resumeFileName) setResumeFileNameOverride(prof.resumeFileName);
    setProfileApplied(true);
  }, [profileApplied]);

  // Map profile.completedCourses (codes/titles) → DB IDs (apply once after courses load)
  useEffect(() => {
    if (completedApplied || !normalizedCourses.length) return;
    const prof = getActiveProfile();
    const completedFromProfile = Array.isArray(prof?.completedCourses) ? prof.completedCourses : [];
    if (!completedFromProfile.length) { setCompletedApplied(true); return; }

    const byCode = new Map();
    const byTitle = new Map();
    normalizedCourses.forEach(c => {
      const nc = normCode(c.code);
      const nt = norm(c.title);
      if (nc) byCode.set(nc, c.id);
      if (nt) byTitle.set(nt, c.id);
    });

    const resolved = new Set();
    completedFromProfile.forEach((val) => {
      const keyC = normCode(val);
      const keyT = norm(val);
      if (keyC && byCode.has(keyC)) resolved.add(byCode.get(keyC));
      else if (keyT && byTitle.has(keyT)) resolved.add(byTitle.get(keyT));
    });

    if (resolved.size > 0) setCompletedIds(Array.from(resolved));
    setCompletedApplied(true);
  }, [normalizedCourses, completedApplied]);

  // Derive lists
  const availableIds = useMemo(
    () => normalizedCourses.map(c => c.id).filter(id => !completedIds.includes(id)),
    [normalizedCourses, completedIds]
  );
  const completedCourses = useMemo(
    () => normalizedCourses.filter(c => completedIds.includes(c.id)),
    [normalizedCourses, completedIds]
  );
  const availableCourses = useMemo(
    () => normalizedCourses.filter(c => availableIds.includes(c.id)),
    [normalizedCourses, availableIds]
  );

  // Filters
  const filterFn = useCallback((c) => {
    const q = searchCourse.toLowerCase();
    const nameOk =
      c.title.toLowerCase().includes(q) ||
      String(c.code || "").toLowerCase().includes(q);
    const skillOk = searchSkill.trim()
      ? c.skills.some(s => String(s).toLowerCase().includes(searchSkill.toLowerCase()))
      : true;
    return nameOk && skillOk;
  }, [searchCourse, searchSkill]);

  const filteredCompleted = useMemo(() => completedCourses.filter(filterFn), [completedCourses, filterFn]);
  const filteredAvailable = useMemo(() => availableCourses.filter(filterFn), [availableCourses, filterFn]);

  // Drag & drop
  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDropToCompleted = (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setCompletedIds(prev => prev.includes(id) ? prev : [...prev, id]); };
  const onDropToAvailable = (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setCompletedIds(prev => prev.filter(cid => cid !== id)); };

  // Quick action buttons (keyboard/mouse)
  const moveToCompleted = (id) => setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const moveToAvailable = (id) => setCompletedIds((prev) => prev.filter((cid) => cid !== id));

  // Persist for Home page (saves derived codes & skills)
  useEffect(() => {
    const codes = completedCourses.map(c => c.code).filter(Boolean);
    localStorage.setItem("profileCourseCodes", JSON.stringify(codes));
    const skillSet = new Set();
    completedCourses.forEach(c => (c.skills || []).forEach(s => skillSet.add(s)));
    localStorage.setItem("profileSkills", JSON.stringify(Array.from(skillSet)));
  }, [completedCourses]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("activeUser");
    navigate("/");
  };

  return (
    <>
      <TopBar />

      <div className="page">
        {/* Header */}
        <div className="row header" style={{ alignItems: "center" }}>
          <button className="return-btn" onClick={() => navigate(-1)} aria-label="Return">← Return</button>
          <h1 className="title" style={{ marginLeft: 8 }}>Profile</h1>
          <div style={{ marginLeft: "auto" }}>
            <button
              className="return-btn"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* User details */}
        <section className="panel">
          <h2 className="section-title">User Details</h2>
          <div className="grid fields">
            <TextField id="firstName" label="First name" value={firstName} setValue={setFirstName} placeholder="Jane" />
            <TextField id="lastName"  label="Last name"  value={lastName}  setValue={setLastName}  placeholder="Doe" />
            <NumberField id="age" label="Age" value={age} setValue={setAge} placeholder="22" min={0} />
            <EmailField  id="email" label="Email" value={email} setValue={setEmail} placeholder="jane@example.com" />
            <TelField    id="phone" label="Phone" value={phone} setValue={setPhone} placeholder="+1 (555) 123-4567" />
            <TextField   id="location" label="Location" value={location} setValue={setLocation} placeholder="Vancouver, BC" />
            <div className="field">
              <label htmlFor="employment">Employment status</label>
              <select id="employment" value={employment} onChange={(e) => setEmployment(e.target.value)}>
                <option value="">Select status…</option>
                {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Resume */}
        <section className="panel">
          <h2 className="section-title">Resume</h2>
          <ResumeUploader
            resumeFile={resumeFile}
            setResumeFile={setResumeFile}
            resumeFileNameOverride={resumeFileNameOverride}
          />
        </section>

        {/* Courses (filters + lists together) */}
        <section className="panel">
          <div className="row between">
            <h2 className="section-title" style={{ margin: 0 }}>Courses</h2>
            <div className="filters">
              <input
                className="search"
                placeholder="Search by course code or name"
                value={searchCourse}
                onChange={(e) => setSearchCourse(e.target.value)}
                aria-label="Search courses by code or name"
              />
              <input
                className="search"
                placeholder="Search by skill"
                value={searchSkill}
                onChange={(e) => setSearchSkill(e.target.value)}
                aria-label="Search courses by skill"
              />
            </div>
          </div>

          <div className="grid lists" style={{ marginTop: 12 }}>
            <div
              className="list"
              onDragOver={onDragOver}
              onDrop={onDropToCompleted}
              aria-label="Completed courses (drop here to move left)"
            >
              <div className="list-header">
                <h3>Completed</h3>
                <span className="count">{filteredCompleted.length}</span>
              </div>
              <div className="cards">
                {filteredCompleted.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    actionLabel="Move to Available"
                    onAction={() => moveToAvailable(c.id)}
                  />
                ))}
                {filteredCompleted.length === 0 && <EmptyState label="Drag courses here" />}
              </div>
            </div>

            <div
              className="list"
              onDragOver={onDragOver}
              onDrop={onDropToAvailable}
              aria-label="Available courses (drop here to move right)"
            >
              <div className="list-header">
                <h3>Available</h3>
                <span className="count">{filteredAvailable.length}</span>
              </div>
              <div className="cards">
                {filteredAvailable.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    actionLabel="Move to Completed"
                    onAction={() => moveToCompleted(c.id)}
                  />
                ))}
                {filteredAvailable.length === 0 && <EmptyState label="No results" />}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------- Inputs ---------- */
function TextField({ id, label, value, setValue, placeholder }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function NumberField({ id, label, value, setValue, placeholder, min }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={min} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function EmailField({ id, label, value, setValue, placeholder }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TelField({ id, label, value, setValue, placeholder }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        pattern="^[0-9+()\\-\\s\\.]{6,}$"
        title="Enter a valid phone number"
      />
    </div>
  );
}

function ResumeUploader({ resumeFile, setResumeFile, resumeFileNameOverride }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const accept = ".pdf,.doc,.docx,.txt";

  const handleFiles = (files) => {
    const f = files?.[0];
    if (!f) return;

    const ext = f.name.split(".").pop()?.toLowerCase();
    const ok = ["pdf", "doc", "docx", "txt"].includes(ext);
    if (!ok) {
      setError("Please upload a PDF, DOC, DOCX, or TXT file.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("File is too large. Max 8 MB.");
      return;
    }
    setError("");
    setResumeFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const displayName = resumeFile
    ? resumeFile.name
    : (resumeFileNameOverride || "");

  return (
    <div className="uploader">
      <div
        className={`dropzone ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        aria-label="Upload resume"
      >
        <p className="dz-title">Drop your resume here, or click to browse</p>
        <p className="dz-sub">PDF, DOC, DOCX, or TXT — up to 8 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="file-input"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="resume-meta">
        {displayName ? (
          <div className="resume-row">
            <span className="resume-name" title={displayName}>{displayName}</span>
            {resumeFile && <span className="resume-size">({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>}
            {resumeFile && <button className="move-btn" onClick={() => setResumeFile(null)}>Remove</button>}
          </div>
        ) : (
          <span className="resume-empty">No resume uploaded yet</span>
        )}
        {error && <div className="resume-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

function CourseCard({ course, draggable, onDragStart, onAction, actionLabel }) {
  return (
    <article className="card" draggable={draggable} onDragStart={onDragStart} role="article">
      <h4 className="course-title">
        {course.code ? <><b>{course.code}</b> — {course.title}</> : course.title}
      </h4>
      <div className="skills">
        {(course.skills || []).map((s) => <span key={s} className="chip">{s}</span>)}
      </div>
      <button className="move-btn" onClick={onAction}>{actionLabel}</button>
    </article>
  );
}

function EmptyState({ label }) {
  return <div style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: "20px 8px" }}>{label}</div>;
}
