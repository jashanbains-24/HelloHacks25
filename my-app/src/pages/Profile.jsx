import { useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import "./Profile.css";

const ALL_COURSES = [
  { id: "c1", title: "Intro to React", skills: ["React", "JS", "Components"] },
  { id: "c2", title: "Advanced CSS Layout", skills: ["CSS", "Flexbox", "Grid"] },
  { id: "c3", title: "TypeScript Basics", skills: ["TypeScript", "Typing"] },
  { id: "c4", title: "Node.js Fundamentals", skills: ["Node.js", "Backend"] },
  { id: "c5", title: "SQL for Developers", skills: ["SQL", "Databases"] },
  { id: "c6", title: "UX Foundations", skills: ["UX", "Accessibility"] },
  { id: "c7", title: "Data Structures", skills: ["Algorithms", "DS"] },
  { id: "c8", title: "Python for Data", skills: ["Python", "Pandas"] },
  { id: "c9", title: "Docker Essentials", skills: ["Docker", "DevOps"] },
  { id: "c10", title: "Git & GitHub", skills: ["Git", "Collaboration"] },
];

const INITIAL_COMPLETED = ["c1", "c5"];
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

  // ----- courses -----
  const [completedIds, setCompletedIds] = useState(INITIAL_COMPLETED);
  const [searchCourse, setSearchCourse] = useState("");
  const [searchSkill, setSearchSkill]   = useState("");

  const availableIds = useMemo(
    () => ALL_COURSES.map(c => c.id).filter(id => !completedIds.includes(id)),
    [completedIds]
  );
  const completedCourses = useMemo(
    () => ALL_COURSES.filter(c => completedIds.includes(c.id)),
    [completedIds]
  );
  const availableCourses = useMemo(
    () => ALL_COURSES.filter(c => availableIds.includes(c.id)),
    [availableIds]
  );

  const filterFn = useCallback((c) => {
    const nameOk = c.title.toLowerCase().includes(searchCourse.toLowerCase());
    const skillOk = searchSkill.trim()
      ? c.skills.some(s => s.toLowerCase().includes(searchSkill.toLowerCase()))
      : true;
    return nameOk && skillOk;
  }, [searchCourse, searchSkill]);

  const filteredCompleted = useMemo(() => completedCourses.filter(filterFn), [completedCourses, filterFn]);
  const filteredAvailable = useMemo(() => availableCourses.filter(filterFn), [availableCourses, filterFn]);

  const moveToCompleted = (id) => setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const moveToAvailable = (id) => setCompletedIds((prev) => prev.filter((cid) => cid !== id));

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDropToCompleted = (e) => { e.preventDefault(); moveToCompleted(e.dataTransfer.getData("text/plain")); };
  const onDropToAvailable = (e) => { e.preventDefault(); moveToAvailable(e.dataTransfer.getData("text/plain")); };

  // ----- LOGOUT -----
  const handleLogout = () => {
    // These keys must match what your LoginModal sets
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("activeUser");
    navigate("/");
  };

  return (
    <>
      <TopBar />

      <div className="page">
        <div className="row header" style={{ alignItems: "center" }}>
          <button className="return-btn" onClick={() => navigate(-1)} aria-label="Return">← Return</button>
          <h1 className="title" style={{ marginLeft: 8 }}>Profile</h1>
          {/* Push the logout button to the far right */}
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

        <section className="panel">
          <h2 className="section-title">Resume</h2>
          <ResumeUploader resumeFile={resumeFile} setResumeFile={setResumeFile} />
        </section>

        <section className="panel">
          <div className="row between">
            <h2 className="section-title">Courses</h2>
            <div className="filters">
              <input
                className="search"
                placeholder="Search by course name"
                value={searchCourse}
                onChange={(e) => setSearchCourse(e.target.value)}
                aria-label="Search courses by name"
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

          <div className="grid lists">
            <div className="list" onDragOver={onDragOver} onDrop={onDropToCompleted} aria-label="Completed courses">
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

            <div className="list" onDragOver={onDragOver} onDrop={onDropToAvailable} aria-label="Available courses">
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

function ResumeUploader({ resumeFile, setResumeFile }) {
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
        {resumeFile ? (
          <div className="resume-row">
            <span className="resume-name" title={resumeFile.name}>{resumeFile.name}</span>
            <span className="resume-size">({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
            <button className="move-btn" onClick={() => setResumeFile(null)}>Remove</button>
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
      <h4 className="course-title">{course.title}</h4>
      <div className="skills">
        {course.skills.map((s) => <span key={s} className="chip">{s}</span>)}
      </div>
      <button className="move-btn" onClick={onAction}>{actionLabel}</button>
    </article>
  );
}

function EmptyState({ label }) {
  return <div style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: "20px 8px" }}>{label}</div>;
}
