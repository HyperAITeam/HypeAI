"""Standalone test for PtyProcess startup flow.

Run:  python test_pty.py [cwd_path]

Tests the exact same 3-phase startup that session_manager.py uses:
  Phase 1 — initial output (3s)
  Phase 2 — probe newline to trigger trust dialog (5s)
  Phase 3 — accept trust dialog if detected (5s)
"""
from __future__ import annotations

import queue
import re
import sys
import threading
import time

# --- ANSI stripping (same as session_manager.py) ---
_ANSI_RE = re.compile(r"\x1b[^a-zA-Z]*[a-zA-Z]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_ansi(text: str) -> str:
    text = _ANSI_RE.sub("", text)
    text = _CTRL_RE.sub("", text)
    return text


def main() -> None:
    from winpty import PtyProcess

    cwd = sys.argv[1] if len(sys.argv) > 1 else None
    command = "claude"

    print(f"=== PtyProcess Startup Test ===")
    print(f"command: {command!r}")
    print(f"cwd:     {cwd!r}")
    print()

    # --- Spawn ---
    print("[spawn] Creating PtyProcess...")
    proc = PtyProcess.spawn(command, cwd=cwd, dimensions=(40, 120))
    print(f"[spawn] PID={proc.pid}, alive={proc.isalive()}")

    # --- Reader thread ---
    output_q: queue.Queue[str] = queue.Queue()
    running = True

    def reader():
        while running:
            try:
                data = proc.read()
                if data:
                    output_q.put(data)
                else:
                    time.sleep(0.05)
            except EOFError:
                print("[reader] EOFError")
                break
            except OSError as e:
                print(f"[reader] OSError: {e}")
                break
            except Exception as e:
                print(f"[reader] {type(e).__name__}: {e}")
                if not running:
                    break
                time.sleep(0.1)
        print("[reader] Thread exited")

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    def drain() -> str:
        parts = []
        while not output_q.empty():
            try:
                parts.append(output_q.get_nowait())
            except queue.Empty:
                break
        return "".join(parts)

    # --- Phase 1: Initial output ---
    print("\n[Phase 1] Waiting 3s for initial output...")
    time.sleep(3)
    startup = drain()
    startup_clean = strip_ansi(startup).lower()
    print(f"[Phase 1] output={len(startup)} chars, alive={proc.isalive()}")
    print(f"[Phase 1] has 'trust': {'trust' in startup_clean}")
    if startup:
        print(f"[Phase 1] raw (first 200): {startup[:200]!r}")

    if not proc.isalive():
        print("[FAIL] Process died during Phase 1!")
        return

    # --- Phase 2: Probe newline ---
    print("\n[Phase 2] Sending probe newline...")
    try:
        proc.write("\r\n")
        print("[Phase 2] write OK")
    except Exception as e:
        print(f"[Phase 2] write FAILED: {e}")
        return

    print("[Phase 2] Waiting 5s for probe response...")
    time.sleep(5)
    probe = drain()
    probe_clean = strip_ansi(probe).lower()
    print(f"[Phase 2] response={len(probe)} chars, alive={proc.isalive()}")
    print(f"[Phase 2] has 'trust': {'trust' in probe_clean}")
    if probe:
        print(f"[Phase 2] raw (first 300): {probe[:300]!r}")

    # --- Phase 3: Trust dialog ---
    if "trust" in startup_clean or "trust" in probe_clean:
        print("\n[Phase 3] Trust dialog detected! Sending Enter to accept...")
        try:
            proc.write("\r\n")
            print("[Phase 3] write OK")
        except Exception as e:
            print(f"[Phase 3] write FAILED: {e}")
            return

        print("[Phase 3] Waiting 5s for acceptance...")
        time.sleep(5)
        post_trust = drain()
        print(f"[Phase 3] post-trust output={len(post_trust)} chars, alive={proc.isalive()}")
        if post_trust:
            print(f"[Phase 3] raw (first 300): {post_trust[:300]!r}")
    else:
        print("\n[Phase 3] No trust dialog — skipped")

    # --- Test a real message ---
    print(f"\n[Test] alive={proc.isalive()}")
    if not proc.isalive():
        print("[FAIL] Process died before test message!")
        return

    test_msg = "Say hello in one sentence."
    print(f"[Test] Sending: {test_msg!r}")
    try:
        proc.write(test_msg + "\r\n")
        print("[Test] write OK")
    except Exception as e:
        print(f"[Test] write FAILED: {e}")
        return

    print("[Test] Collecting response (idle timeout 8s)...")
    chunks = []
    last_data = None
    start = time.time()
    while True:
        if time.time() - start > 60:
            print("[Test] Max timeout reached")
            break
        if last_data is not None and time.time() - last_data > 8:
            break
        try:
            data = output_q.get_nowait()
            chunks.append(data)
            last_data = time.time()
        except queue.Empty:
            time.sleep(0.3)
            if not proc.isalive():
                print("[Test] Process died during collection")
                break

    raw = "".join(chunks)
    clean = strip_ansi(raw).strip()
    print(f"\n[Test] Response ({len(raw)} raw, {len(clean)} clean chars):")
    print("-" * 60)
    # Strip echoed input
    lines = clean.split("\n")
    if lines and test_msg in lines[0]:
        lines = lines[1:]
    print("\n".join(lines)[:2000])
    print("-" * 60)

    # --- Cleanup ---
    running = False
    print("\n[cleanup] Terminating process...")
    try:
        proc.write("/exit\r\n")
        time.sleep(1)
    except Exception:
        pass
    try:
        proc.terminate()
    except Exception:
        pass
    print("[cleanup] Done")
    print("\n=== TEST PASSED ===")


if __name__ == "__main__":
    main()
