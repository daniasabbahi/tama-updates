"""TAMA.exe: opens TAMA in its own program window (no browser, no black window).

Double-click TAMA.exe            -> opens TAMA (a second double-click opens another window on the same TAMA)
TAMA.exe --licence               -> opens the page to enter or replace a licence key
TAMA.exe --server <port>         -> used internally: the hidden helper that runs the app
TAMA.exe --no-update             -> opens TAMA without looking for a newer version
TAMA.exe --selftest              -> used by the Mac build: checks that everything TAMA needs is inside

On a Mac the same file is TAMA.app. The window there uses the Mac's own WebKit; the data folder is
~/Library/Application Support/TAMA; updates are unpacked into that folder (see tama_update.py)
and TAMA.app starts the newest one, so the copy in Applications never has to be replaced.

How it works: a hidden helper process runs the app on this computer only (localhost), and
the TAMA window shows it using Microsoft Edge WebView2, which is built into Windows 10 and 11.
Closing the last TAMA window closes the helper. Every window writes its process number in
%LOCALAPPDATA%\\TAMA\\windows; the helper checks that folder every few seconds and ends itself
when no TAMA window is left, also when a window ended without closing properly (crash, Task
Manager). So no hidden TAMA stays running in the background, and installing a new version
never finds TAMA still in use. If the window cannot be shown, TAMA opens in the browser.

Updates (tama_update.py): a few seconds after TAMA opens it looks online for a newer version,
downloads it in the background; it installs itself the next time TAMA is opened.
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

APP_NAME = "TAMA"
WINDOW_TITLE = "TAMA - Teaching, Assessment, Measuring Achievement"

LOADING_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;
font-family:-apple-system,'Segoe UI',sans-serif;background:linear-gradient(135deg,#1d3557,#5d8584);color:#fff}
.s{width:46px;height:46px;border:5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;
animation:r 1s linear infinite;margin-bottom:22px}@keyframes r{to{transform:rotate(360deg)}}
h1{font-weight:600;margin:0 0 6px}p{opacity:.85;margin:0}</style></head><body>
<div class="s"></div><h1>TAMA</h1><p>Starting, please wait ...</p></body></html>"""


def base_dir():
    # PyInstaller unpacks our files here (the _internal folder); when run as a script, this folder
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def data_dir():
    if sys.platform == "win32":
        root = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
    elif sys.platform == "darwin":
        root = os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    else:
        root = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(root, APP_NAME)


def _log_to_file(ddir, name):
    # a program without a console window has nowhere to print; Streamlit prints a lot
    if sys.stdout is None or sys.stderr is None or getattr(sys, "frozen", False):
        f = open(os.path.join(ddir, name), "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = f


def _healthy(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/_stcore/health", timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def _free_port(start=8501, end=8600):
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("No free port found between 8501 and 8599.")


def _wait_healthy(port, seconds=180):
    end = time.time() + seconds
    while time.time() < end:
        if _healthy(port):
            return True
        time.sleep(0.4)
    return False


# ---------- which TAMA windows are open ----------

def _windows_dir(ddir):
    return os.path.join(ddir, "windows")


def _pid_alive(pid):
    """True if process `pid` is running and (on Windows, packaged) is a TAMA.exe."""
    if pid <= 0:
        return False
    if sys.platform != "win32":
        try:
            os.kill(pid, 0)
            return True
        except PermissionError:
            return True
        except OSError:
            return False
    try:
        import ctypes
        from ctypes import wintypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.OpenProcess.restype = wintypes.HANDLE
        k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        k32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        k32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR,
                                                   ctypes.POINTER(wintypes.DWORD)]
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        h = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        try:
            code = wintypes.DWORD()
            if not k32.GetExitCodeProcess(h, ctypes.byref(code)) or code.value != 259:  # STILL_ACTIVE
                return False
            if getattr(sys, "frozen", False):  # a re-used process number is not a TAMA window
                buf = ctypes.create_unicode_buffer(1024)
                size = wintypes.DWORD(1024)
                if k32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
                    return os.path.basename(buf.value).lower() == os.path.basename(sys.executable).lower()
            return True
        finally:
            k32.CloseHandle(h)
    except Exception:
        return True  # when unsure, never close TAMA under someone's hands


def _register_window(ddir):
    d = _windows_dir(ddir)
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, str(os.getpid())), "w").close()


def _unregister_window(ddir):
    try:
        os.remove(os.path.join(_windows_dir(ddir), str(os.getpid())))
    except OSError:
        pass


def _live_windows(ddir):
    """Process numbers of the TAMA windows that are still open (cleans up the others)."""
    d = _windows_dir(ddir)
    alive = []
    try:
        names = os.listdir(d)
    except OSError:
        return alive
    for name in names:
        if name.isdigit() and _pid_alive(int(name)):
            alive.append(int(name))
        else:
            try:
                os.remove(os.path.join(d, name))
            except OSError:
                pass
    return alive


def _running_info(ddir):
    try:
        return json.load(open(os.path.join(ddir, "running.json"), encoding="utf-8"))
    except Exception:
        return {}


def _watch_windows(ddir):
    """In the helper: end the helper (and with it the app) when no TAMA window is open any more."""
    time.sleep(15)  # the first window registers before it starts the helper; this is extra safety
    misses = 0
    while True:
        misses = 0 if _live_windows(ddir) else misses + 1
        if misses >= 2:  # two checks in a row, a few seconds apart
            print(f"--- no TAMA window open any more; helper ends {time.strftime('%Y-%m-%d %H:%M:%S')}")
            try:
                if _running_info(ddir).get("pid") == os.getpid():
                    os.remove(os.path.join(ddir, "running.json"))
            except Exception:
                pass
            os._exit(0)
        time.sleep(3)


def _build_info():
    try:
        sys.path.insert(0, base_dir())
        import tama_build_info
        return tama_build_info
    except Exception:
        return None


def _install_waiting_update(ddir):
    """An update downloaded earlier (in the background, last time TAMA was open)? Install it now, before TAMA opens.
    Returns True when the installer started; it opens TAMA again when it is done."""
    info = _build_info()
    if info is None:
        return False
    try:
        import tama_update
        if sys.platform != "win32":
            return False  # Mac: see _mac_start_newest
        pend = tama_update.ready_installer(ddir, info.APP_VERSION)
        return bool(pend) and tama_update.launch_installer(ddir, pend)
    except Exception as e:
        print("Waiting update not installed:", e)
        return False


def _start_update_check(ddir, close_tama, set_status=lambda s: None, window=None):
    info = _build_info()
    url = getattr(info, "UPDATE_URL", "") if info else ""
    if not url:
        return
    import tama_update
    threading.Thread(target=tama_update.background_check, daemon=True,
                     args=(ddir, url, info.APP_VERSION, info.PUBLIC_KEY, close_tama),
                     kwargs={"set_status": set_status, "window": window}).start()


def run_server(port):
    """The hidden helper: runs Streamlit with the app."""
    ddir = data_dir()
    os.makedirs(ddir, exist_ok=True)
    _log_to_file(ddir, "tama.log")
    print(f"--- TAMA helper starting {time.strftime('%Y-%m-%d %H:%M:%S')} on port {port}")
    with open(os.path.join(ddir, "running.json"), "w", encoding="utf-8") as f:
        json.dump({"port": port, "pid": os.getpid()}, f)
    os.environ["TAMA_DATA_DIR"] = ddir
    threading.Thread(target=_watch_windows, args=(ddir,), daemon=True).start()
    base = base_dir()
    os.chdir(base)  # Streamlit reads .streamlit/config.toml (colours) from here
    sys.path.insert(0, base)
    from streamlit.web import cli as stcli
    sys.argv = [
        "streamlit", "run", os.path.join(base, "tama_start.py"),
        "--global.developmentMode=false",
        "--server.headless=true",
        "--server.address=localhost",   # only this computer can open it
        f"--server.port={port}",
        "--server.fileWatcherType=none",
        "--server.runOnSave=false",
        "--browser.gatherUsageStats=false",
        "--client.toolbarMode=minimal",
    ]
    sys.exit(stcli.main())


def _start_helper(port):
    if getattr(sys, "frozen", False):
        cmd = [sys.executable, "--server", str(port)]
    else:
        cmd = [sys.executable, os.path.abspath(__file__), "--server", str(port)]
    flags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
    return subprocess.Popen(cmd, creationflags=flags, stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _stop_helper(proc):
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(10)
        except Exception:
            proc.kill()


def _stop_server_if_last(ddir, proc):
    """After a window closed: if no other TAMA window is open, end the helper now
    (also when this window did not start it). Otherwise leave it for the other windows."""
    if _live_windows(ddir):
        return
    if proc is not None:
        _stop_helper(proc)
        return
    pid = int(_running_info(ddir).get("pid") or 0)
    if pid and pid != os.getpid() and _pid_alive(pid):
        try:
            import signal
            os.kill(pid, signal.SIGTERM)  # on Windows this ends the process straight away
        except Exception as e:
            print("Could not end the helper:", e)


# ---------- Mac only ----------

def _mac_start_newest(args):
    """Mac: if a newer TAMA was downloaded earlier (see tama_update.py), start that one instead of
    this copy. The process carries on as the newer version; this copy's code stops here."""
    if sys.platform != "darwin" or not getattr(sys, "frozen", False) or "--no-update" in args:
        return
    info = _build_info()
    if info is None:
        return
    try:
        import tama_update
        exe = tama_update.mac_newer_program(data_dir(), info.APP_VERSION)
    except Exception as e:
        print("Newer Mac version not checked:", e)
        return
    if exe and os.path.abspath(exe) != os.path.abspath(sys.executable):
        try:
            sys.stdout.flush()
        except Exception:
            pass
        os.execv(exe, [exe] + args)


def _mac_started_ok(ddir):
    if sys.platform != "darwin":
        return
    info = _build_info()
    try:
        import tama_update
        tama_update.mac_started_ok(ddir, info.APP_VERSION)
    except Exception as e:
        print("Mac clean-up skipped:", e)


def _mac_menu(webview, get_window, port):
    """Mac: a menu "Licence > Enter or replace licence key" (Windows has a Start-menu item for it).
    Returns (extra create_window arguments, extra start arguments)."""
    if sys.platform != "darwin":
        return {}, {}
    try:
        import inspect
        from webview.menu import Menu, MenuAction
        menu = [Menu("Licence", [MenuAction("Enter or replace licence key",
                                            lambda: get_window().load_url(f"http://localhost:{port}/?licence=1"))])]
        if "menu" in inspect.signature(webview.create_window).parameters:
            return {"menu": menu}, {}
        if "menu" in inspect.signature(webview.start).parameters:
            return {}, {"menu": menu}
    except Exception as e:
        print("No Mac menu:", e)
    return {}, {}


def selftest():
    """Used by the Mac build (GitHub) to check the finished program: every library and the app load."""
    import importlib
    import marshal
    base = base_dir()
    sys.path.insert(0, base)
    info = _build_info()
    assert info is not None, "tama_build_info missing"
    names = ["streamlit", "streamlit.web.cli", "webview", "cryptography", "tama_licence", "tama_update"]
    names += [n for n in getattr(info, "APP_IMPORTS", ()) if n]
    bad = []
    for n in names:
        try:
            importlib.import_module(n)
        except Exception as e:
            bad.append(f"{n}: {e!r}")
    with open(os.path.join(base, "app.bin"), "rb") as f:
        marshal.load(f)
    import tama_licence
    print("computer code:", tama_licence.machine_code())
    print("version:", info.APP_VERSION)
    if bad:
        print("MISSING:\n  " + "\n  ".join(bad))
        raise SystemExit(1)
    print("SELFTEST OK")


def main():
    args = sys.argv[1:]
    if "--selftest" in args:
        selftest()
        return
    if "--server" in args:
        run_server(int(args[args.index("--server") + 1]))
        return
    _mac_start_newest(args)

    want_licence = "--licence" in args or "--license" in args
    check_updates = "--no-update" not in args
    ddir = data_dir()
    os.makedirs(ddir, exist_ok=True)
    _log_to_file(ddir, "tama_window.log")
    _register_window(ddir)  # first, so the helper never ends while this window is starting
    try:
        _window(ddir, want_licence, check_updates)
    finally:
        _unregister_window(ddir)


def _window(ddir, want_licence, check_updates):

    # Already running (e.g. a second double-click)? Then show the same TAMA in another window.
    proc, port = None, None
    try:
        p = int(json.load(open(os.path.join(ddir, "running.json"), encoding="utf-8"))["port"])
        if _healthy(p):
            port = p
    except Exception:
        pass
    if port is None:
        # first window: install an update that is waiting, then let the installer reopen TAMA
        if check_updates and _install_waiting_update(ddir):
            return
        port = _free_port()
        proc = _start_helper(port)
    else:
        check_updates = False  # only the first TAMA window looks for updates
    status = {"text": ""}  # e.g. "Downloading update ...: 40%", shown in the window title
    url = f"http://localhost:{port}/" + ("?licence=1" if want_licence else "")

    try:
        import webview
    except Exception as e:
        print("Window not available, using the browser:", e)
        webview = None

    if webview is not None:
        try:
            webview.settings["ALLOW_DOWNLOADS"] = True   # "Download all my data", PDF and Excel reports
            win_kw, start_kw = _mac_menu(webview, lambda: window, port)
            window = webview.create_window(WINDOW_TITLE, html=LOADING_HTML, width=1400, height=900,
                                           min_size=(900, 600), maximized=True, text_select=True, **win_kw)

            def title():
                try:
                    sys.path.insert(0, base_dir())
                    import tama_licence
                    who = tama_licence.peek_holder(ddir)
                except Exception:
                    who = ""
                return WINDOW_TITLE + (f"   |   Licensed to {who}" if who else "") \
                    + (f"   |   {status['text']}" if status["text"] else "")

            def load():
                if _wait_healthy(port):
                    window.load_url(url)
                    _mac_started_ok(ddir)
                    if check_updates:
                        _start_update_check(ddir, close_tama=window.destroy,
                                            set_status=lambda t: status.update(text=t), window=window)
                    shown = None
                    while True:  # keep the "Licensed to" title up to date (e.g. right after activating)
                        t = title()
                        if t != shown:
                            try:
                                window.set_title(t)
                            except Exception:
                                return
                            shown = t
                        time.sleep(1)
                else:
                    window.load_html("<h2 style='font-family:-apple-system,Segoe UI'>TAMA could not start.</h2>"
                                     "<p style='font-family:-apple-system,Segoe UI'>Please send Dania the file "
                                     f"{os.path.join(ddir, 'tama.log')}</p>")

            webview.start(load, private_mode=False, storage_path=os.path.join(ddir, "window"), **start_kw)
            _unregister_window(ddir)
            _stop_server_if_last(ddir, proc)
            return
        except Exception as e:
            print("Window failed, using the browser:", e)

    # Fallback (no WebView2 on this computer): the web browser. The hidden helper then keeps
    # running until the computer restarts or it is ended in the Task Manager.
    if _wait_healthy(port):
        webbrowser.open(url)
        if check_updates and proc:
            _start_update_check(ddir, close_tama=lambda: _stop_helper(proc))
    if proc:
        proc.wait()
    else:  # keep counting as an open TAMA while the shared helper runs
        while _healthy(port):
            time.sleep(10)


if __name__ == "__main__":
    try:
        main()
    finally:
        if "--server" not in sys.argv[1:] and "--selftest" not in sys.argv[1:]:
            # end this window's process completely, also any background thread still running,
            # so no TAMA.exe stays behind after its window is closed
            try:
                sys.stdout.flush()
            except Exception:
                pass
            os._exit(0)
