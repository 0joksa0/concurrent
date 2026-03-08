export class ReplayController {
  constructor(events, onEvent) {
    this.events = events;
    this.onEvent = onEvent;
    this.index = -1;
    this.speed = 1;
    this.timerId = null;
    this.autoThreadJump = false;
  }

  setSpeed(speed) {
    this.speed = Number(speed) || 1;
  }

  setAutoThreadJump(enabled) {
    this.autoThreadJump = Boolean(enabled);
  }

  current() {
    if (this.index < 0 || this.index >= this.events.length) {
      return null;
    }
    return this.events[this.index];
  }

  restart() {
    this.pause();
    this.index = -1;
    this.onEvent(null, this.index, this.events.length);
  }

  setIndex(index) {
    if (this.events.length === 0) {
      this.index = -1;
      this.onEvent(null, this.index, this.events.length);
      return;
    }

    const bounded = Math.max(-1, Math.min(index, this.events.length - 1));
    this.index = bounded;
    this.onEvent(this.current(), this.index, this.events.length);
  }

  next() {
    if (this.events.length === 0) {
      this.onEvent(null, this.index, this.events.length);
      return;
    }

    const targetThread = this.current()?.thread_name;

    if (this.index < this.events.length - 1) {
      if (this.autoThreadJump && targetThread) {
        let i = this.index + 1;
        while (i < this.events.length && (this.events[i].thread_name || 'unregistered') !== targetThread) {
          i += 1;
        }
        this.index = i < this.events.length ? i : this.events.length - 1;
      } else {
        this.index += 1;
      }
    }

    this.onEvent(this.current(), this.index, this.events.length);
  }

  prev() {
    if (this.events.length === 0) {
      this.onEvent(null, this.index, this.events.length);
      return;
    }

    if (this.index > 0) {
      this.index -= 1;
      this.onEvent(this.current(), this.index, this.events.length);
      return;
    }

    this.index = -1;
    this.onEvent(null, this.index, this.events.length);
  }

  play() {
    if (this.timerId || this.events.length === 0) {
      return;
    }

    const tick = () => {
      if (this.index >= this.events.length - 1) {
        this.pause();
        return;
      }

      this.next();
      this.timerId = window.setTimeout(tick, Math.max(40, 500 / this.speed));
    };

    tick();
  }

  pause() {
    if (!this.timerId) {
      return;
    }
    window.clearTimeout(this.timerId);
    this.timerId = null;
  }
}
