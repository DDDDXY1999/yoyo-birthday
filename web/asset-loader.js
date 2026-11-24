const audio = { path: 'audio/birthday-piano-v2.m4a', size: 464906, type: 'audio/mp4' };
// Pick one film for this visit. Rotating a phone must not start a second download.
const video = matchMedia('(max-width: 950px), (pointer: coarse)').matches
  ? { path: 'meteor-mobile-v1.mp4', size: 1422215, type: 'video/mp4' }
  : { path: 'meteor-shower.mp4', size: 6869274, type: 'video/mp4' };
const totalBytes = audio.size + video.size;
const received = new Map();
const jobs = new Map();
const finished = new Set();
const failedStyles = new Set();
const failedMedia = new Set();
const listeners = new Set();
const localUrl = path => new URL(path, import.meta.url).href;
let total = 0;
let active;
let ready = false;
let failedModuleGraph = false;

function publish() {
  const loadedBytes = (received.get(audio.path) || 0) + (received.get(video.path) || 0);
  const percent = ready ? 100 : Math.min(99, Math.floor(100 * loadedBytes / totalBytes));
  const progress = { loadedBytes, totalBytes, percent, completed: finished.size, total };
  for (const listener of listeners) listener(progress);
}

function asset(key, load) {
  if (!jobs.has(key)) {
    const job = Promise.resolve().then(load).then(value => {
      finished.add(key);
      publish();
      return value;
    }, error => {
      jobs.delete(key);
      throw error;
    });
    jobs.set(key, job);
  }
  return jobs.get(key);
}

async function download(path, media) {
  const controller = new AbortController();
  let timer;
  function watchConnection() {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), 45000);
  }
  watchConnection();
  try {
    const response = await fetch(localUrl(path), {
      signal: controller.signal,
      // Media URLs keep the same contents across releases. A failed integrity or
      // transport check should fetch a fresh copy on the visitor's next attempt.
      cache: media ? (failedMedia.has(path) ? 'reload' : 'force-cache') : 'default'
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (response.status === 206 && (!media ||
        response.headers.get('content-range') !== 'bytes 0-' + (media.size - 1) + '/' + media.size)) {
      throw new Error('服务器只返回了部分文件');
    }
    const chunks = [];
    let size = 0;
    function accept(chunk) {
      chunks.push(chunk);
      size += chunk.byteLength ?? chunk.size;
      if (media) {
        if (size > media.size) throw new Error('媒体文件大小不匹配');
        received.set(path, size);
        publish();
      }
    }
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength) {
          watchConnection();
          accept(value);
        }
      }
    } else {
      accept(await response.blob());
    }
    if (!size || (media && size !== media.size)) throw new Error('文件未完整下载');
    failedMedia.delete(path);
    return new Blob(chunks, { type: media?.type || response.headers.get('content-type') || '' });
  } catch (error) {
    const stalled = controller.signal.aborted;
    controller.abort();
    if (media) failedMedia.add(path);
    received.delete(path);
    publish();
    throw new Error(path + '：' + (stalled ? '下载暂时中断，请重试。' : error.message));
  } finally {
    clearTimeout(timer);
  }
}

async function loadModule(path) {
  try {
    return await import(localUrl(path));
  } catch {
    // A browser can retain a failed dependency in its per-document module map.
    // Replacing only the top-level module URL would leave that dependency stuck.
    failedModuleGraph = true;
    throw new Error('页面组件加载失败，请重新加载。');
  }
}

function ensureStyle(original) {
  const href = original.href;
  if (original.sheet && original.media !== 'print') return Promise.resolve();
  const retry = failedStyles.delete(href);
  const link = retry ? original.cloneNode() : original;
  return new Promise((resolve, reject) => {
    const listeners = new AbortController();
    function failed() {
      listeners.abort();
      failedStyles.add(href);
      reject(new Error(href + ' 未能加载'));
    }
    function loaded() {
      if (!link.sheet) return failed();
      listeners.abort();
      link.media = 'all';
      link.dataset.loadState = 'loaded';
      resolve();
    }
    link.addEventListener('load', loaded, {signal: listeners.signal});
    link.addEventListener('error', failed, {signal: listeners.signal});
    if (retry) {
      delete link.dataset.loadState;
      original.replaceWith(link);
    } else if (link.dataset.loadState === 'error') {
      failed();
    } else if (link.dataset.loadState === 'loaded' || (link.sheet && link.media !== 'print')) {
      loaded();
    }
  });
}

async function loadIcon() {
  const link = document.querySelector('link[rel~="icon"]');
  const path = link?.dataset.icon || 'favicon.svg';
  const blob = await download(path);
  const url = URL.createObjectURL(blob);
  try {
    const icon = new Image();
    await new Promise((resolve, reject) => {
      icon.onload = resolve;
      icon.onerror = () => reject(new Error('网站图标未能解码'));
      icon.src = url;
    });
    if (link) link.href = url;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function prepare() {
  const styles = [...document.querySelectorAll('link[rel~="stylesheet"]')];
  total = styles.length + 5; // styles, complete native module graph, Three.js, icon and two media files
  publish();
  const workshop = asset('workshop', () => loadModule('workshop.js?v=10'));
  const three = asset('Three.js', async () => {
    const { loadThree } = await loadModule('cake.js?v=3');
    if (!(await loadThree())?.WebGLRenderer) throw new Error('三维组件未就绪');
  });
  const mediaUrl = file => asset(file.path, async () => URL.createObjectURL(await download(file.path, file)));
  const [audioUrl, videoUrl, module] = await Promise.all([
    mediaUrl(audio), mediaUrl(video), workshop, three, asset('favicon', loadIcon),
    ...styles.map(link => asset(link.href, () => ensureStyle(link)))
  ]);
  ready = true;
  publish();
  return { audioUrl, videoUrl, createWorkshop: module.createWorkshop };
}

export function preloadBirthdayAssets(onProgress) {
  if (failedModuleGraph && !active) {
    window.location.reload();
    return new Promise(() => {}); // The replacement document starts a fresh attempt.
  }
  if (onProgress) listeners.add(onProgress);
  active ??= prepare();
  publish();
  // Keep the blobs for the document lifetime, including back/forward cache.
  return active.catch(error => {
    active = undefined;
    throw error;
  }).finally(() => listeners.delete(onProgress));
}

// The head starts this module independently of the invitation's UI module graph.
// Keep even a rejected first attempt so the UI can display its retry control.
active = prepare();
active.catch(() => {});
