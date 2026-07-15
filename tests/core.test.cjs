'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTrackTitle,
  filterAudioPaths,
  getNextIndex,
  getPreviousIndex,
  normalizeEqGains,
  formatTime,
  sortTracks,
  snapBounds,
  isForwardAttached,
  findForwardFollowers
} = require('../src/core.cjs');

test('parses artist and title from a common filename', () => {
  assert.deepEqual(parseTrackTitle('D:/Music/Portishead - Roads.mp3'), { artist: 'Portishead', title: 'Roads' });
});

test('falls back to the filename for an untagged track', () => {
  assert.deepEqual(parseTrackTitle('D:/Music/Untitled.flac'), { artist: '', title: 'Untitled' });
});

test('filters supported audio paths and removes duplicates', () => {
  assert.deepEqual(filterAudioPaths(['a.mp3', 'b.txt', 'a.mp3', 'C.M4A']), ['a.mp3', 'C.M4A']);
});

test('next and previous navigation wraps', () => {
  assert.equal(getNextIndex(2, 3), 0);
  assert.equal(getPreviousIndex(0, 3), 2);
});

test('shuffle does not return the active track', () => {
  assert.equal(getNextIndex(1, 3, true, () => 0.9), 2);
});

test('equalizer normalization clamps and pads ten values', () => {
  assert.deepEqual(normalizeEqGains([20, -20, 3]), [12, -12, 3, 0, 0, 0, 0, 0, 0, 0]);
});

test('formats short and long durations', () => {
  assert.equal(formatTime(247), '04:07');
  assert.equal(formatTime(3723), '1:02:03');
});

test('sorts tracks without mutating input', () => {
  const tracks = [{ title: '10', artist: 'B' }, { title: '2', artist: 'A' }];
  assert.deepEqual(sortTracks(tracks, 'title').map((track) => track.title), ['2', '10']);
  assert.equal(tracks[0].title, '10');
});

test('snaps a window to the bottom edge of another window', () => {
  const moving = { x: 102, y: 294, width: 300, height: 160 };
  const target = { id: 'player', bounds: { x: 100, y: 100, width: 300, height: 200 } };
  const snapped = snapBounds(moving, [target], null, 12);
  assert.equal(snapped.bounds.y, 300);
  assert.equal(snapped.targetId, 'player');
  assert.equal(snapped.edge, 'bottom');
});

test('snaps to a screen work area edge', () => {
  const snapped = snapBounds(
    { x: 9, y: 90, width: 300, height: 160 },
    [],
    { x: 0, y: 0, width: 1920, height: 1040 },
    12
  );
  assert.equal(snapped.bounds.x, 0);
  assert.equal(snapped.targetId, 'screen');
});

test('does not snap outside the threshold', () => {
  const moving = { x: 250, y: 250, width: 200, height: 100 };
  assert.deepEqual(snapBounds(moving, [], { x: 0, y: 0, width: 1920, height: 1040 }, 12).bounds, moving);
});

test('detects forward bottom and right attachments', () => {
  const parent = { x: 20, y: 20, width: 300, height: 200 };
  assert.equal(isForwardAttached(parent, { x: 20, y: 220, width: 300, height: 100 }), true);
  assert.equal(isForwardAttached(parent, { x: 320, y: 20, width: 300, height: 200 }), true);
});

test('finds a complete attached chain', () => {
  const items = [
    { id: 'player', bounds: { x: 10, y: 10, width: 300, height: 100 } },
    { id: 'equalizer', bounds: { x: 10, y: 110, width: 300, height: 100 } },
    { id: 'playlist', bounds: { x: 10, y: 210, width: 300, height: 200 } }
  ];
  assert.deepEqual(findForwardFollowers('player', items), ['equalizer', 'playlist']);
  assert.deepEqual(findForwardFollowers('equalizer', items), ['playlist']);
});
