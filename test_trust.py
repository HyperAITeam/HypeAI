"""Test trust dialog acceptance with different Enter keys.

Run:  python test_trust.py [cwd_path]

Tries \r, then \r\n, then \n to find which one Claude Code accepts.
"""
from __future__ import annotations

import queue
import re
import sys
import threading
import time

_ANSI_RE = re.compile(r"\x1b[^a-zA-Z]*[a-zA-Z]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_ansi(text: str) -> str:
    text = _ANSI_RE.sub("", text)
    text = _CTRL_RE.sub("", text)
    return text


def main() -> None:
    from winpty import PtyProcess

    cwd = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"=== Trust Dialog Test ===")
    print(f"cwd: {cwd!r}")
    print()

    proc = PtyProcess.spawn("claude", cwd=cwd, dimensions=(40, 120))
    print(f"[spawn] PID={proc.pid}, alive={proc.isalive()}")

    output_q: queue.Queue[str] = queue.Queue()
    running = True
    read_count = [0]

    def reader():
        while running:
            try:
                data = proc.read()
                if data:
                    read_count[0] += 1
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
        print("[reader] exited")

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

    def wait_for_data(timeout: float = 10.0) -> str:
        """Wait until data arrives or timeout."""
        start = time.time()
        last_data = None
        chunks = []
        while True:
            if time.time() - start > timeout:
                break
            if last_data and time.time() - last_data > 3.0:
                break
            try:
                data = output_q.get_nowait()
                chunks.append(data)
                last_data = time.time()
            except queue.Empty:
                time.sleep(0.2)
        return "".join(chunks)

    # --- Step 1: Wait for startup ---
    print("\n[1] Waiting 3s for startup...")
    time.sleep(3)
    startup = drain()
    print(f"    output={len(startup)} chars, alive={proc.isalive()}")
    print(f"    reader thread alive: {t.is_alive()}, reads: {read_count[0]}")

    # --- Step 2: Send message to trigger trust ---
    print("\n[2] Sending 'hello\\r' (just CR, no LF)...")
    proc.write("hello\r")
    print(f"    write OK")

    print("    Waiting for response...")
    resp1 = wait_for_data(timeout=10)
    clean1 = strip_ansi(resp1)
    print(f"    response={len(resp1)} raw, {len(clean1)} clean chars")
    print(f"    reader thread alive: {t.is_alive()}, reads: {read_count[0]}")
    has_trust = "trust" in clean1.lower()
    print(f"    has 'trust': {has_trust}")

    if not has_trust:
        print("\n    No trust dialog — Claude might already trust this folder.")
        print(f"    Clean output:\n{clean1[:500]}")
        # Clean up
        running = False
        try:
            proc.terminate()
        except Exception:
            pass
        return

    print(f"    Trust dialog preview: {clean1[:200]!r}")

    # --- Step 3: Try accepting with \r only ---
    print("\n[3] Accepting trust with just '\\r' (CR only)...")
    print(f"    Pre-write: alive={proc.isalive()}, reader alive={t.is_alive()}")
    proc.write("\r")
    print(f"    write OK")

    print("    Waiting 15s for post-trust output...")
    post1 = wait_for_data(timeout=15)
    clean_post1 = strip_ansi(post1)
    print(f"    post-trust: {len(post1)} raw, {len(clean_post1)} clean chars")
    print(f"    alive={proc.isalive()}, reader alive={t.is_alive()}, reads={read_count[0]}")

    if len(post1) > 0:
        print(f"    SUCCESS with \\r! Output preview: {clean_post1[:300]!r}")
    else:
        print("    No output from \\r. Trying '\\r\\n'...")

        # --- Step 3b: Try \r\n ---
        proc.write("\r\n")
        print(f"    Sent \\r\\n, waiting 10s...")
        post2 = wait_for_data(timeout=10)
        clean_post2 = strip_ansi(post2)
        print(f"    post-trust: {len(post2)} raw, {len(clean_post2)} clean chars")
        print(f"    alive={proc.isalive()}, reader alive={t.is_alive()}, reads={read_count[0]}")

        if len(post2) > 0:
            print(f"    SUCCESS with \\r\\n! Output preview: {clean_post2[:300]!r}")
        else:
            print("    No output from \\r\\n. Trying '\\n'...")

            # --- Step 3c: Try \n ---
            proc.write("\n")
            print(f"    Sent \\n, waiting 10s...")
            post3 = wait_for_data(timeout=10)
            clean_post3 = strip_ansi(post3)
            print(f"    post-trust: {len(post3)} raw, {len(clean_post3)} clean chars")

            if len(post3) > 0:
                print(f"    SUCCESS with \\n! Output preview: {clean_post3[:300]!r}")
            else:
                print("    No output from \\n either.")

                # --- Step 3d: Try space + enter ---
                print("\n    Trying space then \\r...")
                proc.write(" \r")
                post4 = wait_for_data(timeout=10)
                clean_post4 = strip_ansi(post4)
                print(f"    post-trust: {len(post4)} raw, {len(clean_post4)} clean chars")

                if len(post4) > 0:
                    print(f"    SUCCESS with space+\\r! Output: {clean_post4[:300]!r}")
                else:
                    print("    ALL ATTEMPTS FAILED. Reader might be stuck.")
                    print(f"    Final state: alive={proc.isalive()}, "
                          f"reader alive={t.is_alive()}, reads={read_count[0]}")

    # --- Cleanup ---
    print("\n[cleanup]")
    running = False
    try:
        proc.terminate()
    except Exception:
        pass
    print("Done")


if __name__ == "__main__":
    main()
