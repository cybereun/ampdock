'use strict';

const path = require('node:path');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

function parseTrackTitle(filePath) {
  const base = path.basename(String(filePath || ''), path.extname(String(filePath || ''))).trim();
  const separator = base.indexOf(' - ');
  if (separator < 0) return { artist: '', title: base || 'Unknown track' };
  return {
    artist: base.slice(0, separator).trim(),
    title: base.slice(separator + 3).trim() || 'Unknown track'
  };
}

function isAudioPath(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase());
}

function filterAudioPaths(paths) {
  return [...new Set(Array.from(paths || []).filter(isAudioPath))];
}

function getNextIndex(currentIndex, count, shuffle = false, random = Math.random) {
  if (count <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= count) return 0;
  if (!shuffle || count === 1) return (currentIndex + 1) % count;
  let next = currentIndex;
  while (next === currentIndex) next = Math.floor(random() * count);
  return next;
}

function getPreviousIndex(currentIndex, count) {
  if (count <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= count) return count - 1;
  return (currentIndex - 1 + count) % count;
}

function clamp(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeEqGains(values) {
  const incoming = Array.isArray(values) ? values : [];
  return Array.from({ length: 10 }, (_, index) => clamp(incoming[index], -12, 12, 0));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function sortTracks(tracks, mode) {
  const copy = Array.from(tracks || []);
  const text = (value) => String(value || '').toLocaleLowerCase();
  const compare = (left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  if (mode === 'artist') return copy.sort((a, b) => compare(text(a.artist), text(b.artist)) || compare(text(a.title), text(b.title)));
  if (mode === 'album') return copy.sort((a, b) => compare(text(a.album), text(b.album)) || compare(text(a.track), text(b.track)));
  if (mode === 'title') return copy.sort((a, b) => compare(text(a.title), text(b.title)));
  if (mode === 'duration') return copy.sort((a, b) => (a.duration || 0) - (b.duration || 0));
  return copy;
}

function overlap(startA, endA, startB, endB, minimum = 24) {
  return Math.min(endA, endB) - Math.max(startA, startB) >= minimum;
}

function snapBounds(moving, targets, workArea, threshold = 18) {
  const result = { ...moving };
  const candidates = [];
  const right = moving.x + moving.width;
  const bottom = moving.y + moving.height;

  for (const target of targets || []) {
    const bounds = target.bounds;
    const targetRight = bounds.x + bounds.width;
    const targetBottom = bounds.y + bounds.height;
    const vertical = overlap(moving.y, bottom, bounds.y, targetBottom);
    const horizontal = overlap(moving.x, right, bounds.x, targetRight);
    if (vertical) {
      candidates.push({ distance: Math.abs(right - bounds.x), x: bounds.x - moving.width, targetId: target.id, edge: 'left' });
      candidates.push({ distance: Math.abs(moving.x - targetRight), x: targetRight, targetId: target.id, edge: 'right' });
    }
    if (horizontal) {
      candidates.push({ distance: Math.abs(bottom - bounds.y), y: bounds.y - moving.height, targetId: target.id, edge: 'top' });
      candidates.push({ distance: Math.abs(moving.y - targetBottom), y: targetBottom, targetId: target.id, edge: 'bottom' });
    }
  }

  if (workArea) {
    const areaRight = workArea.x + workArea.width;
    const areaBottom = workArea.y + workArea.height;
    candidates.push({ distance: Math.abs(moving.x - workArea.x), x: workArea.x, targetId: 'screen', edge: 'left' });
    candidates.push({ distance: Math.abs(right - areaRight), x: areaRight - moving.width, targetId: 'screen', edge: 'right' });
    candidates.push({ distance: Math.abs(moving.y - workArea.y), y: workArea.y, targetId: 'screen', edge: 'top' });
    candidates.push({ distance: Math.abs(bottom - areaBottom), y: areaBottom - moving.height, targetId: 'screen', edge: 'bottom' });
  }

  const nearest = candidates.filter((item) => item.distance <= threshold).sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return { bounds: result, targetId: null, edge: null };
  if (Number.isFinite(nearest.x)) result.x = Math.round(nearest.x);
  if (Number.isFinite(nearest.y)) result.y = Math.round(nearest.y);
  return { bounds: result, targetId: nearest.targetId, edge: nearest.edge };
}

function isForwardAttached(parent, child, tolerance = 2) {
  const parentRight = parent.x + parent.width;
  const parentBottom = parent.y + parent.height;
  const childRight = child.x + child.width;
  const childBottom = child.y + child.height;
  const below = Math.abs(child.y - parentBottom) <= tolerance && overlap(parent.x, parentRight, child.x, childRight);
  const right = Math.abs(child.x - parentRight) <= tolerance && overlap(parent.y, parentBottom, child.y, childBottom);
  return below || right;
}

function findForwardFollowers(rootId, items, tolerance = 2) {
  const map = new Map((items || []).map((item) => [item.id, item.bounds]));
  const result = [];
  const visit = (parentId) => {
    const parent = map.get(parentId);
    if (!parent) return;
    for (const [id, bounds] of map) {
      if (id === parentId || result.includes(id) || id === rootId) continue;
      if (isForwardAttached(parent, bounds, tolerance)) {
        result.push(id);
        visit(id);
      }
    }
  };
  visit(rootId);
  return result;
}

module.exports = {
  AUDIO_EXTENSIONS,
  parseTrackTitle,
  isAudioPath,
  filterAudioPaths,
  getNextIndex,
  getPreviousIndex,
  clamp,
  normalizeEqGains,
  formatTime,
  sortTracks,
  snapBounds,
  isForwardAttached,
  findForwardFollowers
};
