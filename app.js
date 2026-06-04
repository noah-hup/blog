(() => {
  let allPosts = [];
  let filteredPosts = [];
  let activeTag = "all";
  let searchQuery = "";

  const homeView = document.getElementById("home-view");
  const postView = document.getElementById("post-view");
  const feed = document.getElementById("feed");
  const noResults = document.getElementById("no-results");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const backBtn = document.getElementById("back-btn");
  const navLogo = document.getElementById("nav-logo");
  const tagDropdown = document.getElementById("search-tag-dropdown");

  function init() {
    document.title = CONFIG.blogTitle;
    navLogo.innerHTML = CONFIG.blogTitle + '<span>.</span>';

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
        buildTagDropdown();
        applyFilters();
        handleHash();
      })
      .catch(() => {
        feed.innerHTML = '<p style="color:#999;padding:32px 0">Could not load posts.</p>';
      });

    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      searchClear.classList.toggle("visible", searchQuery.length > 0);
      applyFilters();
    });

    searchInput.addEventListener("focus", () => {
      tagDropdown.classList.remove("hidden");
    });

    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchQuery = "";
      searchClear.classList.remove("visible");
      applyFilters();
      searchInput.focus();
    });

    const contactBtn = document.getElementById("contact-btn");
    const contactDropdown = document.getElementById("contact-dropdown");

    contactBtn.addEventListener("click", e => {
      e.stopPropagation();
      contactDropdown.classList.toggle("hidden");
      tagDropdown.classList.add("hidden");
    });

    document.addEventListener("click", e => {
      if (!document.getElementById("nav-search").contains(e.target)) {
        tagDropdown.classList.add("hidden");
      }
      if (!document.getElementById("contact-wrap").contains(e.target)) {
        contactDropdown.classList.add("hidden");
      }
    });

    backBtn.addEventListener("click", goHome);
    navLogo.addEventListener("click", e => { e.preventDefault(); goHome(); });
    window.addEventListener("hashchange", handleHash);

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
    if (location.hash.startsWith("#post/")) history.pushState(null, "", location.pathname);
  }

  function goHome() {
    history.pushState(null, "", location.pathname);
    showHome();
  }

  function showPost(post) {
    homeView.classList.remove("active");
    postView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });
    history.pushState(null, "", `#post/${encodeURIComponent(post.id)}`);
    renderPost(post);
  }

  // ── Tag dropdown ─────────────────────────────────────────────────────────
  function buildTagDropdown() {
    const counts = {};
    allPosts.forEach(p => (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);

    tagDropdown.innerHTML = "";

    const allPill = makePill("All", "all");
    tagDropdown.appendChild(allPill);
    sorted.forEach(tag => tagDropdown.appendChild(makePill(tag, tag)));
    updatePills();
  }

  function makePill(label, tag) {
    const btn = document.createElement("button");
    btn.className = "search-tag-pill";
    btn.textContent = label;
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      setTag(tag);
    });
    return btn;
  }

  function updatePills() {
    tagDropdown.querySelectorAll(".search-tag-pill").forEach(btn => {
      const tag = btn.textContent === "All" ? "all" : btn.textContent;
      btn.classList.toggle("active", tag === activeTag);
    });
  }

  function setTag(tag) {
    activeTag = tag;
    updatePills();
    applyFilters();
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  function applyFilters() {
    filteredPosts = allPosts.filter(post => {
      const matchTag = activeTag === "all" || (post.tags || []).includes(activeTag);
      if (!matchTag) return false;
      if (!searchQuery) return true;
      const haystack = [post.title, post.subtitle, post.author, ...(post.tags || []), post.content || ""]
        .join(" ").toLowerCase();
      return haystack.includes(searchQuery);
    });
    renderFeed();
  }

  // ── Feed ─────────────────────────────────────────────────────────────────
  function renderFeed() {
    feed.innerHTML = "";
    if (filteredPosts.length === 0) {
      noResults.classList.remove("hidden");
    } else {
      noResults.classList.add("hidden");
      filteredPosts.forEach(post => feed.appendChild(createCard(post)));
    }
  }

  function createCard(post) {
    const card = document.createElement("div");
    card.className = "post-card";

    const readTime = estimateReadTime(post.content);
    const dateStr = formatDate(post.date);

    const thumbHtml = post.coverImage
      ? `<img class="card-thumb" src="${escHtml(post.coverImage)}" alt="" loading="lazy" />`
      : `<div class="card-thumb-placeholder"></div>`;

    card.innerHTML = `
      <div class="card-body-row">
        <div class="card-body-left">
          <div class="card-title">${escHtml(post.title)}</div>
          ${post.subtitle ? `<div class="card-subtitle">${escHtml(post.subtitle)}</div>` : ""}
        </div>
        ${thumbHtml}
      </div>
      <div class="card-stats-row">
        <span class="card-date-read">${dateStr} · ${readTime} min read</span>
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

    document.getElementById("post-tags").innerHTML = (post.tags || []).map(t =>
      `<span class="post-tag-badge">${escHtml(t)}</span>`
    ).join("");

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
