/* ── Init ── */
document.title = CONFIG.blogTitle;

let allPosts  = [];
let activeTag = null;
let editingId = null;
let currentPostId = null;
let ghToken = null;

/* ── Load posts ── */
async function loadPosts() {
  try {
    const res = await fetch(`${CONFIG.postsFile}?_=${Date.now()}`);
    allPosts = await res.json();
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderTagFilter();
    renderList();
  } catch {
    document.getElementById('post-list').innerHTML =
      '<p class="empty-state">Could not load posts.</p>';
  }
}

/* ── Tag filter ── */
function allTags() {
  const set = new Set();
  allPosts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function renderTagFilter() {
  const el   = document.getElementById('tag-filter');
  const tags = allTags();
  el.innerHTML = '';
  if (!tags.length) return;
  el.appendChild(mkChip('All', !activeTag));
  tags.forEach(t => el.appendChild(mkChip(t, activeTag === t)));
}

function mkChip(text, active) {
  const b = document.createElement('button');
  b.textContent = text;
  b.className   = 'tag-chip' + (active ? ' active' : '');
  b.addEventListener('click', () => {
    activeTag = text === 'All' ? null : text;
    renderTagFilter();
    renderList();
  });
  return b;
}

/* ── Post list ── */
function renderList() {
  currentPostId = null;
  showView('list');
  const el    = document.getElementById('post-list');
  const posts = activeTag
    ? allPosts.filter(p => (p.tags || []).includes(activeTag))
    : allPosts;

  if (!posts.length) {
    el.innerHTML = '<p class="empty-state">No posts yet.</p>';
    return;
  }

  const [first, ...rest] = posts;
  el.innerHTML = featuredCard(first) +
    (rest.length ? `<span class="section-label">More</span>` + rest.map(secondaryCard).join('') : '');

  el.querySelectorAll('[data-id]').forEach(card =>
    card.addEventListener('click', () => openPost(card.dataset.id))
  );
}

function featuredCard(p) {
  const imgHtml = p.image
    ? `<img class="featured-image" src="${ea(p.image)}" alt="${ea(p.title)}" loading="lazy" />`
    : `<div class="featured-no-image"></div>`;
  return `
    <div class="post-card-featured" data-id="${p.id}">
      ${imgHtml}
      <div class="featured-text">
        <div class="card-kicker">${kickerHtml(p)}</div>
        <h2 class="card-headline">${eh(p.title)}</h2>
        ${p.summary ? `<p class="card-deck">${eh(p.summary)}</p>` : ''}
      </div>
    </div>`;
}

function secondaryCard(p) {
  const hasImg  = !!p.image;
  const imgHtml = hasImg
    ? `<img class="card-thumb" src="${ea(p.image)}" alt="${ea(p.title)}" loading="lazy" />`
    : '';
  return `
    <div class="post-card${hasImg ? '' : ' no-img'}" data-id="${p.id}">
      <div>
        <div class="card-kicker">${kickerHtml(p)}</div>
        <h3 class="card-headline">${eh(p.title)}</h3>
        ${p.summary ? `<p class="card-deck">${eh(p.summary)}</p>` : ''}
      </div>
      ${hasImg ? imgHtml : ''}
    </div>`;
}

function kickerHtml(p) {
  const tags = (p.tags || []).map(t => `<span class="card-tag-label">${eh(t)}</span>`).join('');
  return `<span>${fmtDate(p.date)}</span>${tags}`;
}

/* ── Single post ── */
function openPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  currentPostId = id;

  const tags    = (post.tags || []).map(t => `<span>${eh(t)}</span>`).join('');
  const imgHtml = post.image
    ? `<img class="post-hero" src="${ea(post.image)}" alt="${ea(post.title)}" />`
    : '';

  document.getElementById('post-content').innerHTML = `
    <div class="post-kicker">
      <span>${fmtDate(post.date)}</span>
      ${tags}
    </div>
    <h1 class="post-headline">${eh(post.title)}</h1>
    ${post.summary ? `<p class="post-deck">${eh(post.summary)}</p>` : ''}
    <div class="byline-rule"></div>
    ${imgHtml}
    <div class="prose">${marked.parse(post.content || '')}</div>
  `;

  showView('post');
  window.scrollTo(0, 0);
}

document.getElementById('back-btn').addEventListener('click', renderList);

function showView(which) {
  document.getElementById('list-view').classList.toggle('hidden', which !== 'list');
  document.getElementById('post-view').classList.toggle('hidden', which !== 'post');
}

/* ── Modal ── */
const overlay = document.getElementById('modal-overlay');

function openNewModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New post';
  document.getElementById('post-form').reset();
  document.getElementById('preview-pane').classList.add('hidden');
  setStatus('', '');
  // Show token field only if no token in memory yet
  document.getElementById('auth-section').style.display =
    ghToken ? 'none' : '';
  overlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('f-title').focus(), 50);
}

function openEditModal(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit post';
  document.getElementById('f-title').value   = post.title   || '';
  document.getElementById('f-tags').value    = (post.tags || []).join(', ');
  document.getElementById('f-image').value   = post.image   || '';
  document.getElementById('f-summary').value = post.summary || '';
  document.getElementById('f-content').value = post.content || '';
  document.getElementById('preview-pane').classList.add('hidden');
  setStatus('', '');
  document.getElementById('auth-section').style.display =
    ghToken ? 'none' : '';
  overlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('f-title').focus(), 50);
}

document.getElementById('modal-close').addEventListener('click', () => overlay.classList.add('hidden'));
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

/* ── Preview ── */
document.getElementById('preview-btn').addEventListener('click', () => {
  document.getElementById('preview-content').innerHTML =
    marked.parse(document.getElementById('f-content').value);
  document.getElementById('preview-pane').classList.remove('hidden');
});

/* ── Publish / Save ── */
document.getElementById('post-form').addEventListener('submit', async e => {
  e.preventDefault();

  // Collect token — prefer in-memory, then field input
  const fieldToken = document.getElementById('gh-token').value.trim();
  if (fieldToken) ghToken = fieldToken;
  const token = ghToken;
  if (!token) {
    document.getElementById('auth-section').style.display = '';
    setStatus('Enter your GitHub token above.', 'error');
    return;
  }

  const title   = document.getElementById('f-title').value.trim();
  const tags    = document.getElementById('f-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const summary = document.getElementById('f-summary').value.trim();
  const image   = document.getElementById('f-image').value.trim();
  const content = document.getElementById('f-content').value;

  setStatus('Saving…', '');

  try {
    const meta = await ghGet(token, CONFIG.postsFile);
    let updated;

    if (editingId) {
      updated = allPosts.map(p => {
        if (p.id !== editingId) return p;
        const u = { ...p, title, tags, summary, content };
        if (image) u.image = image; else delete u.image;
        return u;
      });
    } else {
      const id   = slugify(title) + '-' + Date.now();
      const date = new Date().toISOString().slice(0, 10);
      updated = [{ id, title, date, tags, summary, content, ...(image && { image }) }, ...allPosts];
    }

    await ghPut(token, CONFIG.postsFile, meta.sha,
      JSON.stringify(updated, null, 2),
      editingId ? `Edit post: ${title}` : `Add post: ${title}`);

    setStatus(editingId ? 'Saved!' : 'Published!', 'success');
    overlay.classList.add('hidden');
    if (!editingId) document.getElementById('post-form').reset();
    setTimeout(loadPosts, 2500);
  } catch (err) {
    // If token was rejected, clear it and show the field again
    if (err.message.includes('403') || err.message.includes('401')) {
      ghToken = null;
      document.getElementById('auth-section').style.display = '';
      document.getElementById('gh-token').value = '';
    }
    setStatus(`Error: ${err.message}`, 'error');
  }
});

/* ── Secret type shortcuts ── */
(function () {
  let buf = '';
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { overlay.classList.add('hidden'); buf = ''; return; }
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;

    buf = (buf + e.key).slice(-5);

    if (buf.endsWith('write')) { buf = ''; openNewModal(); }
    if (buf.endsWith('edit') && currentPostId) { buf = ''; openEditModal(currentPostId); }
  });
})();

/* ── GitHub API ── */
function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function ghGet(token, path) {
  const r = await fetch(
    `https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}/contents/${path}`,
    { headers: ghHeaders(token) }
  );
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
  return r.json();
}

async function ghPut(token, path, sha, content, message) {
  const r = await fetch(
    `https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}/contents/${path}`,
    {
      method: 'PUT',
      headers: ghHeaders(token),
      body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), sha }),
    }
  );
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
  return r.json();
}

/* ── Helpers ── */
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function eh(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function ea(s) { return eh(s); }

function setStatus(msg, cls) {
  const el = document.getElementById('publish-status');
  el.textContent = msg;
  el.className = cls;
}

/* ── Boot ── */
loadPosts();
