/* سجل التراجع/الإعادة: لقطات JSON خفيفة (الصور بمعرّفات أصول لا بيانات). لا لقطة لكل حركة فأرة، بل عند انتهاء التعديل. */
(function () {
  const Ed = window.Ed; let stack = [], idx = -1, busy = false, timer = null; const MAX = 100;
  Ed.history = {
    reset() { stack = []; idx = -1; this.push(true); },
    push(now) {
      if (busy) return; clearTimeout(timer);
      const go = () => { const s = JSON.stringify(Ed.serialize({ embed: false })); if (stack[idx] === s) return; stack = stack.slice(0, idx + 1); stack.push(s); if (stack.length > MAX) stack.shift(); idx = stack.length - 1; Ed.emit("history"); };
      now === true ? go() : (timer = setTimeout(go, 250));
    },
    canUndo() { return idx > 0; }, canRedo() { return idx < stack.length - 1; },
    async undo() { if (!this.canUndo()) return; clearTimeout(timer); this.flush(); idx--; await this.restore(); },
    async redo() { if (!this.canRedo()) return; idx++; await this.restore(); },
    flush() { clearTimeout(timer); const s = JSON.stringify(Ed.serialize({ embed: false })); if (stack[idx] !== s) { stack = stack.slice(0, idx + 1); stack.push(s); idx = stack.length - 1; } },
    async restore() { busy = true; try { await Ed.deserialize(JSON.parse(stack[idx]), { keepZoom: true }); } finally { busy = false; } Ed.emit("history"); Ed.emit("changed", "history"); },
    get busy() { return busy; }, get size() { return stack.length; }
  };
  ["added", "removed", "modified"].forEach(k => Ed.on("object:" + k, () => Ed.history.push()));
  Ed.on("text:exited", () => Ed.history.push()); Ed.on("changed", () => Ed.history.push());
})();
