"""TAMA automatic updates.

How it works, in short:
  * Dania publishes each new version as two files: the installer (TAMA-Setup-<version>.exe)
    and a small "update file" (tama-update.json) that says which version is newest, the
    installer's name and its fingerprint (SHA-256). The update file is signed with the same
    private key as the licence keys, so TAMA only ever installs installers that Dania made.
  * When TAMA starts, it reads the update file from the web address in TAMA settings.txt
    (in the background, a few seconds after the window opens). Without internet nothing happens.
  * If the version there is newer, TAMA downloads the installer in the background and checks its
    fingerprint. Nothing is asked: the next time the user opens TAMA, the update installs itself
    first (a small progress window, about a minute) and then the new version opens.
  * The installer only replaces the program files. Licence keys and data live in
    %LOCALAPPDATA%\\TAMA and are never touched, so everything keeps working after an update.

On a Mac there is no installer. The update file also lists the Mac versions (see MAC below);
TAMA downloads the right one (Apple silicon or Intel), unpacks it into its own data folder
(~/Library/Application Support/TAMA/program/<version>/TAMA.app) and, the next time it is opened,
starts that newer copy instead of itself. Nothing in the Applications folder is changed, so no
password or permission is needed and testers never reinstall.

The update file looks like this (the signature covers every other field):
  {"app": "TAMA", "version": "2026-11-05", "file": "TAMA-Setup-2026-11-05.exe",
   "sha256": "...", "size": 201234567, "notes": "What is new", "published": "2026-11-05T10:00:00",
   "signature": "..."}
A Mac-ready update file also has
  "mac": {"arm64":  {"file": "TAMA-2026-11-05-mac-arm64.zip",  "sha256": "...", "size": 123},
          "x86_64": {"file": "TAMA-2026-11-05-mac-x86_64.zip", "sha256": "...", "size": 123}}
(Windows copies of TAMA ignore it). Each "file" there works like the one below.
"file" may be a full web address or just a file name; a file name is looked up next to the
update file (on GitHub: in the same release).
"""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

MANIFEST_NAME = "tama-update.json"
UPDATES_DIR = "updates"
PENDING_FILE = "pending.json"
MAX_TRIES = 2          # give up on a downloaded installer that did not install after this many tries
CHECK_TIMEOUT = 10     # seconds to wait for the update file


def _b64e(b):
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def log(*a):
    print("[update]", time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


# ---------- versions ----------

def version_key(v):
    """Turn '2026-10-27g' or '1.2.10' into something that sorts the way people expect:
    numbers as numbers, letters after numbers, and a longer version after its shorter start."""
    parts = re.findall(r"\d+|[A-Za-z]+", str(v or ""))
    return tuple((0, int(p), "") if p.isdigit() else (1, 0, p.lower()) for p in parts)


def is_newer(candidate, current):
    return version_key(candidate) > version_key(current)


# ---------- signing (Dania's computer only) and checking ----------

def _body(manifest):
    data = {k: v for k, v in manifest.items() if k != "signature"}
    return json.dumps(data, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def sign_manifest(private_key, manifest):
    m = dict(manifest)
    m.pop("signature", None)
    m["signature"] = _b64e(private_key.sign(_body(m)))
    return m


def verify_manifest(manifest, public_key_b64):
    """True only if the update file was signed with Dania's private key."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    try:
        Ed25519PublicKey.from_public_bytes(_b64d(public_key_b64)).verify(
            _b64d(manifest["signature"]), _body(manifest))
        return manifest.get("app") == "TAMA" and bool(manifest.get("version")) and bool(manifest.get("file")) \
            and bool(re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("sha256", ""))))
    except Exception:
        return False


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------- reading the update file ----------

def _get(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": "TAMA-updater", "Cache-Control": "no-cache"})
    return urllib.request.urlopen(req, timeout=timeout)


def fetch_manifest(update_url, public_key_b64, timeout=CHECK_TIMEOUT):
    """The signed update file, or None (no internet, no file yet, or not signed by Dania)."""
    if not update_url:
        return None
    try:
        with _get(update_url, timeout) as r:
            # GitHub sends us on to the real file; remember where it is, for the installer
            final_url = r.geturl()
            manifest = json.loads(r.read(64 * 1024).decode("utf-8-sig"))
    except Exception as e:
        log("could not read the update file:", e)
        return None
    if not isinstance(manifest, dict) or not verify_manifest(manifest, public_key_b64):
        log("the update file is not signed with the TAMA key; ignored")
        return None
    f = str(manifest["file"])
    manifest["_download_url"] = f if re.match(r"https?://", f) else urllib.parse.urljoin(update_url, urllib.parse.quote(f))
    manifest["_seen_at"] = final_url
    return manifest


# ---------- downloading ----------

def _updates_dir(data_dir):
    return os.path.join(data_dir, UPDATES_DIR)


def _safe_name(manifest):
    name = os.path.basename(urllib.parse.urlsplit(str(manifest["file"])).path) or "TAMA-Setup.exe"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name if name.lower().endswith(".exe") else name + ".exe"


def read_pending(data_dir):
    try:
        return json.load(open(os.path.join(_updates_dir(data_dir), PENDING_FILE), encoding="utf-8"))
    except Exception:
        return None


def _write_pending(data_dir, pending):
    p = os.path.join(_updates_dir(data_dir), PENDING_FILE)
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(pending, f, indent=1)
    os.replace(p + ".tmp", p)


def clear_updates(data_dir):
    shutil.rmtree(_updates_dir(data_dir), ignore_errors=True)


def download(manifest, data_dir, progress=None, timeout=60):
    """Download the installer, check its fingerprint, and remember it as ready to install.
    Returns the installer's path, or None."""
    udir = _updates_dir(data_dir)
    clear_updates(data_dir)  # anything older is no longer needed
    os.makedirs(udir, exist_ok=True)
    path = os.path.join(udir, _safe_name(manifest))
    part = path + ".part"
    try:
        with _get(manifest["_download_url"], timeout) as r, open(part, "wb") as f:
            total = int(r.headers.get("Content-Length") or manifest.get("size") or 0)
            done, last = 0, -1
            while True:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                pct = int(done * 100 / total) if total else -1
                if progress and pct != last:
                    progress(pct)
                    last = pct
    except Exception as e:
        log("download failed:", e)
        try:
            os.remove(part)
        except OSError:
            pass
        return None
    if sha256_of(part) != manifest["sha256"]:
        log("the downloaded installer does not match the update file; deleted")
        os.remove(part)
        return None
    os.replace(part, path)
    _write_pending(data_dir, {"version": manifest["version"], "path": path, "sha256": manifest["sha256"],
                              "notes": manifest.get("notes", ""), "tries": 0})
    log("downloaded", manifest["version"], "to", path)
    return path


def ready_installer(data_dir, current_version):
    """A downloaded, checked installer for a newer version, or None.
    Cleans up after a finished update, and gives up on one that keeps failing."""
    pend = read_pending(data_dir)
    if not pend:
        if os.path.isdir(_updates_dir(data_dir)):
            clear_updates(data_dir)
        return None
    if not is_newer(pend.get("version"), current_version) or pend.get("tries", 0) >= MAX_TRIES:
        log("removing the downloaded update", pend.get("version"), "(installed, or it did not install)")
        clear_updates(data_dir)
        return None
    path = pend.get("path", "")
    if not os.path.isfile(path) or sha256_of(path) != pend.get("sha256"):
        clear_updates(data_dir)
        return None
    return pend


# ---------- installing ----------

def launch_installer(data_dir, pend):
    """Start the installer on its own; it waits a moment for TAMA to close, replaces the program
    files, then opens TAMA again. Returns True when it started."""
    pend["tries"] = pend.get("tries", 0) + 1
    _write_pending(data_dir, pend)
    args = [pend["path"], "/SILENT", "/SP-", "/SUPPRESSMSGBOXES", "/NORESTART", "/NOCANCEL",
            "/CLOSEAPPLICATIONS", "/FORCECLOSEAPPLICATIONS", "/RELAUNCH=1",
            "/LOG=" + os.path.join(data_dir, "update-install.log")]
    flags = 0
    if sys.platform == "win32":
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP: lives on after TAMA closes
    try:
        subprocess.Popen(args, creationflags=flags, close_fds=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log("installer started for", pend["version"])
        return True
    except Exception as e:
        log("could not start the installer:", e)
        return False


# ---------- asking the user ----------

def ask_yes_no(title, text, window=None):
    """A normal Windows question box (Yes / No). Returns True for Yes."""
    if sys.platform == "win32":
        try:
            import ctypes
            MB_YESNO, MB_ICONQUESTION, MB_SETFOREGROUND, MB_TOPMOST = 0x4, 0x20, 0x10000, 0x40000
            return ctypes.windll.user32.MessageBoxW(
                None, text, title, MB_YESNO | MB_ICONQUESTION | MB_SETFOREGROUND | MB_TOPMOST) == 6
        except Exception as e:
            log("question box failed:", e)
    if window is not None:
        try:
            return bool(window.create_confirmation_dialog(title, text))
        except Exception as e:
            log("question box failed:", e)
    return False


def tell(title, text):
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, title, 0x40 | 0x10000 | 0x40000)  # information icon
            return
        except Exception:
            pass
    log(title, "-", text)


# ---------- the whole check, run by TAMA.exe in the background ----------

def background_check(data_dir, update_url, current_version, public_key_b64, close_tama=None,
                     set_status=lambda s: None, window=None, delay=8):
    """Look for a newer version and download it; it is installed the next time TAMA opens.
    (close_tama is no longer used; kept so older callers still work.)"""
    if sys.platform == "darwin":
        return mac_background_check(data_dir, update_url, current_version, public_key_b64,
                                    set_status=set_status, delay=delay)
    try:
        time.sleep(delay)  # let TAMA open first
        m = fetch_manifest(update_url, public_key_b64)
        if not m:
            return
        if not is_newer(m["version"], current_version):
            log("TAMA is up to date:", current_version, "(newest published:", m["version"] + ")")
            return
        log("newer version found:", m["version"], "(this is", current_version + ")")
        pend = ready_installer(data_dir, current_version)
        if not pend or pend.get("version") != m["version"]:
            set_status(f"Downloading update {m['version']} ...")
            path = download(m, data_dir, progress=lambda pct: set_status(
                f"Downloading update {m['version']}" + (f": {pct}%" if pct >= 0 else " ...")))
            set_status("")
            if not path:
                return  # try again next time
            pend = read_pending(data_dir)
        # No question for the user: the update is installed by itself the next time TAMA opens
        # (a small "Setup - TAMA" progress window for about a minute, then the new version opens).
        set_status(f"Update {m['version']} is ready: close TAMA and open it again to install it")
        log("update", m["version"], "is ready; it installs the next time TAMA opens")
    except Exception as e:
        log("update check stopped:", e)
        set_status("")


# ======================================================================================
# Mac: updates without an installer
# ======================================================================================

MAC_PROGRAM_DIR = "program"   # inside the data folder: program/<version>/TAMA.app
MAC_TRIES_FILE = "starts.json"
MAC_MAX_STARTS = 3            # a downloaded version that fails to open this often is skipped and removed


def mac_arch():
    """'arm64' on Apple silicon (also when this copy runs as Intel under Rosetta), else 'x86_64'."""
    import platform
    if platform.machine() == "arm64":
        return "arm64"
    try:
        out = subprocess.run(["/usr/sbin/sysctl", "-n", "sysctl.proc_translated"],
                             capture_output=True, text=True, timeout=5).stdout.strip()
        if out == "1":
            return "arm64"  # an Intel copy on an Apple-silicon Mac moves to the faster native version
    except Exception:
        pass
    return "x86_64"


def _program_root(data_dir):
    return os.path.join(data_dir, MAC_PROGRAM_DIR)


def _mac_exe(folder):
    return os.path.join(folder, "TAMA.app", "Contents", "MacOS", "TAMA")


def mac_versions(data_dir):
    """{version: folder} of the TAMA versions unpacked in the data folder."""
    root = _program_root(data_dir)
    found = {}
    try:
        names = os.listdir(root)
    except OSError:
        return found
    for name in names:
        folder = os.path.join(root, name)
        if not name.endswith((".part", ".old")) and os.path.isfile(_mac_exe(folder)):
            found[name] = folder
    return found


def _starts(folder):
    try:
        return int(json.load(open(os.path.join(folder, MAC_TRIES_FILE), encoding="utf-8")).get("starts", 0))
    except Exception:
        return 0


def mac_newer_program(data_dir, current_version):
    """The program file of the newest unpacked version that is newer than this one, or None.
    Counts the start, so a version that never manages to open is given up after a few tries."""
    best = None
    for v, folder in mac_versions(data_dir).items():
        if not is_newer(v, current_version):
            continue
        if _starts(folder) >= MAC_MAX_STARTS:
            log("version", v, "did not open several times; removed")
            shutil.rmtree(folder, ignore_errors=True)
            continue
        if best is None or is_newer(v, best[0]):
            best = (v, folder)
    if best is None:
        return None
    v, folder = best
    try:
        n = _starts(folder) + 1  # (read before the file is opened for writing, which empties it)
        with open(os.path.join(folder, MAC_TRIES_FILE), "w", encoding="utf-8") as f:
            json.dump({"starts": n}, f)
    except OSError:
        pass
    return _mac_exe(folder)


def mac_started_ok(data_dir, current_version):
    """Called once this version's window shows TAMA: reset its start counter and remove older
    unpacked versions and old downloads."""
    for v, folder in mac_versions(data_dir).items():
        if v == current_version:
            try:
                os.remove(os.path.join(folder, MAC_TRIES_FILE))
            except OSError:
                pass
        elif not is_newer(v, current_version):
            shutil.rmtree(folder, ignore_errors=True)
    root = _program_root(data_dir)
    try:
        for name in os.listdir(root):
            if name.endswith((".part", ".old")):
                shutil.rmtree(os.path.join(root, name), ignore_errors=True)
    except OSError:
        pass


def mac_download(entry, version, data_dir, progress=None, timeout=60):
    """Download the Mac zip for `version`, check it and unpack it to program/<version>.
    Returns the new TAMA.app folder, or None."""
    root = _program_root(data_dir)
    os.makedirs(root, exist_ok=True)
    zpath = os.path.join(root, f"download-{re.sub(r'[^0-9A-Za-z.-]', '_', version)}.zip.part")
    try:
        with _get(entry["_download_url"], timeout) as r, open(zpath, "wb") as f:
            total = int(r.headers.get("Content-Length") or entry.get("size") or 0)
            done, last = 0, -1
            while True:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                pct = int(done * 100 / total) if total else -1
                if progress and pct != last:
                    progress(pct)
                    last = pct
        if sha256_of(zpath) != entry["sha256"]:
            log("the downloaded Mac version does not match the update file; deleted")
            return None
        safe_v = re.sub(r"[^0-9A-Za-z.-]", "_", version)
        tmp = os.path.join(root, safe_v + ".part")
        shutil.rmtree(tmp, ignore_errors=True)
        # ditto keeps the app's links and signature intact (Python's zipfile would not)
        subprocess.run(["/usr/bin/ditto", "-x", "-k", zpath, tmp], check=True, timeout=600,
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not os.path.isfile(_mac_exe(tmp)):
            log("the Mac update has no TAMA.app inside; ignored")
            shutil.rmtree(tmp, ignore_errors=True)
            return None
        subprocess.run(["/usr/bin/xattr", "-dr", "com.apple.quarantine", tmp], timeout=120,
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        final = os.path.join(root, safe_v)
        if os.path.exists(final):
            os.replace(final, final + ".old")
        os.replace(tmp, final)
        log("Mac version", version, "is ready in", final)
        return final
    except Exception as e:
        log("Mac update failed:", e)
        return None
    finally:
        try:
            os.remove(zpath)
        except OSError:
            pass


def mac_background_check(data_dir, update_url, current_version, public_key_b64,
                         set_status=lambda s: None, delay=8):
    try:
        time.sleep(delay)
        m = fetch_manifest(update_url, public_key_b64)
        if not m:
            return
        if not is_newer(m["version"], current_version):
            log("TAMA is up to date:", current_version, "(newest published:", m["version"] + ")")
            return
        entry = (m.get("mac") or {}).get(mac_arch())
        if not isinstance(entry, dict) or not entry.get("file") or \
                not re.fullmatch(r"[0-9a-f]{64}", str(entry.get("sha256", ""))):
            log("version", m["version"], "has no Mac version yet")
            return
        if m["version"] in mac_versions(data_dir):
            set_status(f"Update {m['version']} is ready: close TAMA and open it again to use it")
            return
        f = str(entry["file"])
        entry = dict(entry)
        entry["_download_url"] = f if re.match(r"https?://", f) else \
            urllib.parse.urljoin(update_url, urllib.parse.quote(f))
        set_status(f"Downloading update {m['version']} ...")
        ok = mac_download(entry, m["version"], data_dir, progress=lambda pct: set_status(
            f"Downloading update {m['version']}" + (f": {pct}%" if pct >= 0 else " ...")))
        set_status(f"Update {m['version']} is ready: close TAMA and open it again to use it" if ok else "")
    except Exception as e:
        log("update check stopped:", e)
        set_status("")
