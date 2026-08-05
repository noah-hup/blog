(() => {
  let allPosts = [];

  const homeView = document.getElementById("home-view");
  const postView = document.getElementById("post-view");
  const feed = document.getElementById("feed");
  const noResults = document.getElementById("no-results");
  const backBtn = document.getElementById("back-btn");
  const readingProgress = document.getElementById("reading-progress");
  const readingProgressBar = document.getElementById("reading-progress-bar");

  function init() {
    document.title = CONFIG.blogTitle;

    document.getElementById("footer-copyright").textContent =
      `© ${new Date().getFullYear()} ${CONFIG.authorName}`;

    const apiUrl = `https://api.github.com/repos/${CONFIG.githubRepo}/contents/${CONFIG.postsDir}`;
    const getIds = fetch(apiUrl)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(files => files
        .filter(f => f.name.endsWith(".md") && f.name !== "_template.md" && f.name !== "_index.json")
        .map(f => f.name.replace(/\.md$/, ""))
      )
      .catch(() => fetch("posts/_index.json").then(r => r.json()));

    getIds
      .then(ids => Promise.all(ids.map(id =>
        fetch(`posts/${id}.md`)
          .then(r => r.text())
          .then(raw => {
            const { meta, body } = parseFrontmatter(raw);
            return { id, ...meta, content: body };
          })
      )))
      .then(posts => {
        allPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderFeed();
        handleHash();
      })
      .catch(() => {
        feed.innerHTML = '<p style="color:#999;padding:32px 0">Could not load posts.</p>';
      });

    backBtn.addEventListener("click", goHome);
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("scroll", updateReadingProgress, { passive: true });

    loadIdeas();
  }

  function loadIdeas() {
    fetch("ideas/ideas.json")
      .then(r => r.json())
      .then(ideas => {
        if (!ideas.length) return;
        const wrap = document.getElementById("ideas-wrap");
        wrap.innerHTML = `
          <p class="ideas-heading">coming up</p>
          <div class="ideas-list">
            ${ideas.map(i => `
              <div class="idea-item">
                <span class="idea-title">${i.title}</span>
                ${i.description ? `<span class="idea-desc">${i.description}</span>` : ""}
              </div>
            `).join("")}
          </div>`;
      })
      .catch(() => {});
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  function handleHash() {
    const hash = location.hash;
    if (hash.startsWith("#post/")) {
      const id = decodeURIComponent(hash.slice(6));
      const post = allPosts.find(p => p.id === id);
      if (post) { showPost(post); return; }
    }
    showHome();
  }

  function showHome() {
    homeView.classList.add("active");
    postView.classList.remove("active");
    readingProgress.classList.add("hidden");
    if (location.hash.startsWith("#post/")) history.pushState(null, "", location.pathname);
  }

  function goHome() {
    history.pushState(null, "", location.pathname);
    showHome();
  }

  function showPost(post) {
    homeView.classList.remove("active");
    postView.classList.add("active");
    readingProgress.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    updateReadingProgress();
    history.pushState(null, "", `#post/${encodeURIComponent(post.id)}`);
    renderPost(post);
  }

  function updateReadingProgress() {
    if (!postView.classList.contains("active")) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
    readingProgressBar.style.width = pct + "%";
  }

  // ── Feed ─────────────────────────────────────────────────────────────────
  function renderFeed() {
    feed.innerHTML = "";
    if (allPosts.length === 0) {
      noResults.classList.remove("hidden");
    } else {
      noResults.classList.add("hidden");
      allPosts.forEach(post => feed.appendChild(createCard(post)));
    }
  }

  function createCard(post) {
    const card = document.createElement("div");
    card.className = "post-card";

    const readTime = estimateReadTime(post.content);
    const dateStr = formatDate(post.date);

    const thumbHtml = post.coverImage
      ? `<div class="card-image-wrap"><img class="card-image" src="${escHtml(post.coverImage)}" alt="" loading="lazy" /></div>`
      : "";

    card.innerHTML = `
      ${thumbHtml}
      <div class="card-content">
        <div class="card-title">${escHtml(post.title)}</div>
        ${post.subtitle ? `<div class="card-subtitle">${escHtml(post.subtitle)}</div>` : ""}
        <div class="card-stats-row">
          <span class="card-date-read">${dateStr} · ${readTime} min read</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => showPost(post));
    return card;
  }

  // ── Post ─────────────────────────────────────────────────────────────────
  function renderPost(post) {
    const readTime = estimateReadTime(post.content);

    const avatarEl = document.getElementById("post-avatar");
    if (CONFIG.authorAvatar) {
      avatarEl.src = CONFIG.authorAvatar;
      avatarEl.style.display = "";
    } else {
      avatarEl.style.display = "none";
    }

    document.getElementById("post-author").textContent = post.author || CONFIG.authorName;
    document.getElementById("post-date").textContent = formatDate(post.date);
    document.getElementById("post-read-time").textContent = readTime;

    document.getElementById("post-title").textContent = post.title;

    const subtitleEl = document.getElementById("post-subtitle");
    subtitleEl.textContent = post.subtitle || "";
    subtitleEl.style.display = post.subtitle ? "" : "none";

    const coverWrap = document.getElementById("post-cover-wrap");
    const coverEl = document.getElementById("post-cover");
    if (post.coverImage) {
      coverEl.src = post.coverImage;
      coverEl.alt = post.title;
      coverWrap.style.display = "";
    } else {
      coverWrap.style.display = "none";
    }

    document.getElementById("post-body").innerHTML = marked.parse(post.content || "");
    document.title = `${post.title} — ${CONFIG.blogTitle}`;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function estimateReadTime(content) {
    if (!content) return 1;
    return Math.max(1, Math.round(content.trim().split(/\s+/).length / 200));
  }

  function escHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function parseFrontmatter(raw) {
    if (!raw.startsWith("---")) return { meta: {}, body: raw };
    const end = raw.indexOf("\n---", 3);
    if (end === -1) return { meta: {}, body: raw };
    const block = raw.slice(4, end).trim();
    const body = raw.slice(end + 4).replace(/^\n/, "");
    const meta = {};
    block.split("\n").forEach(line => {
      const colon = line.indexOf(":");
      if (colon === -1) return;
      const key = line.slice(0, colon).trim();
      let val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      }
      meta[key] = val;
    });
    return { meta, body };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
