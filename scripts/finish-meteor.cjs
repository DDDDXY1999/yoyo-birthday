// Browser checks and the short recording advance the real, muted film to its
// final frames. Media events still run when the recording's JS clock is frozen.
module.exports = async function finishMeteor(page) {
  const film = page.locator('#meteor-film');
  let timeout;
  try {
    await Promise.race([
      film.evaluate(async video => {
        await video.play();
        if (!Number.isFinite(video.duration)) throw new Error('Missing meteor film duration');
        await new Promise((resolve, reject) => {
          const listeners = new AbortController();
          video.addEventListener('ended', () => { listeners.abort(); resolve(); }, {signal: listeners.signal});
          video.addEventListener('error', () => { listeners.abort(); reject(new Error('Meteor film failed to play')); }, {signal: listeners.signal});
          video.currentTime = Math.max(0, video.duration - 0.2);
        });
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out waiting for the meteor film to end')), 15000);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
};
