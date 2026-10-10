// Client-side rate limiters: stop accidental floods before they hit the server's own limits.
// limit('message') throws a friendly "slow down" error when the bucket is full.
class Bucket {
  constructor(max, windowMs) { this.max = max; this.win = windowMs; this.t = []; }
  wait() {
    const now = Date.now();
    this.t = this.t.filter(x => now - x < this.win);
    return this.t.length >= this.max ? this.win - (now - this.t[0]) : 0;
  }
  hit() { this.t.push(Date.now()); }
}
const BUCKETS = {
  message: new Bucket(6, 6000),     // 6 messages every 6 seconds
  react: new Bucket(10, 6000),
  edit: new Bucket(6, 20000),
  upload: new Bucket(3, 30000),     // pictures
  emoji: new Bucket(5, 60000),
  app: new Bucket(3, 30000),        // giveaways and polls
  ticket: new Bucket(3, 60000),
  call: new Bucket(4, 60000),
  friend: new Bucket(6, 60000),
  server: new Bucket(3, 60000),
  invite: new Bucket(8, 60000)
};
export function limit(name) {
  const b = BUCKETS[name];
  if (!b) return;
  const w = b.wait();
  if (w > 0) throw Object.assign(new Error(`Slow down a little: try again in ${Math.ceil(w / 1000)}s.`), { code: 'rate' });
  b.hit();
}
