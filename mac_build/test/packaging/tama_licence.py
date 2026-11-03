"""TAMA licence keys: reading, checking and storing them on the user's computer.

A licence key is a small signed note: who it is for, which computer (or any computer),
and until when. Dania signs it with her private key in the Key Maker; the app only holds
the matching public key, so it can check a key without internet but cannot make one.

Key text:  TAMA-<payload>.<signature>   (both parts base64url, payload is JSON)
"""
import base64
import hashlib
import json
import os
import sys
from datetime import date, datetime

KEY_PREFIX = "TAMA-"
LICENCE_FILE = "licence.key"
STATE_FILE = "licence_state.json"
WARN_DAYS = 30           # warn this many days before a key runs out
CLOCK_SLACK_DAYS = 2     # how far back the computer clock may move before we complain


def _b64e(b):
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def clean_key_text(text):
    """Keys often get broken over lines or wrapped in spaces when sent by e-mail."""
    return "".join((text or "").split())


# ---------- the computer code ----------

def _raw_machine_id():
    if sys.platform == "win32":
        try:
            import winreg
            k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography",
                               0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY)
            return str(winreg.QueryValueEx(k, "MachineGuid")[0])
        except OSError:
            pass
    if sys.platform == "darwin":
        # the Mac's hardware number (IOPlatformUUID); it stays the same after updates and reinstalls
        try:
            import re
            import subprocess
            out = subprocess.run(["/usr/sbin/ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
                                 capture_output=True, text=True, timeout=10).stdout
            m = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', out)
            if m:
                return m.group(1)
        except Exception:
            pass
    for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            v = open(p, encoding="ascii").read().strip()
            if v:
                return v
        except OSError:
            pass
    import uuid
    return "node-%012x" % uuid.getnode()


def machine_code():
    """Short code for this computer, e.g. 7KQ2-M9XD-4TPA. Users send it to Dania."""
    h = hashlib.sha256(("TAMA-machine:" + _raw_machine_id()).encode("utf-8")).digest()
    s = base64.b32encode(h).decode("ascii")[:12]
    return "-".join(s[i:i + 4] for i in range(0, 12, 4))


# ---------- signing (Key Maker only) and checking ----------

def sign_payload(private_key, payload):
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return KEY_PREFIX + _b64e(body) + "." + _b64e(private_key.sign(body))


def read_key(text, public_key_b64):
    """Return (payload, None) when the signature is good, else (None, reason)."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    t = clean_key_text(text)
    if not t.startswith(KEY_PREFIX) or "." not in t:
        return None, "This does not look like a TAMA licence key. Copy the whole key, starting with TAMA-."
    body_s, sig_s = t[len(KEY_PREFIX):].split(".", 1)
    try:
        body, sig = _b64d(body_s), _b64d(sig_s)
        Ed25519PublicKey.from_public_bytes(_b64d(public_key_b64)).verify(sig, body)
        payload = json.loads(body.decode("utf-8"))
    except InvalidSignature:
        return None, "This key is not valid. Please check you copied all of it, or ask for a new key."
    except Exception:
        return None, "This key is damaged or incomplete. Please copy the whole key again."
    if not isinstance(payload, dict) or payload.get("v") != 1:
        return None, "This key was made for a different version of TAMA. Please ask for a new key."
    return payload, None


def check_payload(payload, revoked=(), today=None, this_machine=None):
    """Return (ok, message). The message explains a problem in plain words."""
    today = today or date.today()
    if payload.get("id") in set(revoked):
        return False, "This licence key has been withdrawn. Please contact Dania for a new key."
    allowed = allowed_machines(payload)
    if allowed != "ANY" and (this_machine or machine_code()) not in allowed:
        return False, ("This key was made for other computers. Send Dania the computer code shown "
                       "below and ask for a key that includes this computer.")
    exp = payload.get("expires")
    if exp:
        try:
            exp_d = date.fromisoformat(exp)
        except ValueError:
            return False, "This key has a bad expiry date. Please ask for a new key."
        if today > exp_d:
            return False, f"This licence key ran out on {exp_d:%d %B %Y}. Please ask Dania for a renewed key."
    return True, ""


def allowed_machines(payload):
    """'ANY', or the list of computer codes the key works on (newer keys list up to 3 computers)."""
    ms = payload.get("machines")
    if isinstance(ms, list):
        return "ANY" if "ANY" in ms else ms
    m = payload.get("machine", "ANY")
    return "ANY" if m == "ANY" else [m]


def holder(payload):
    """'Name (email)' for showing who a key belongs to."""
    name, email = (payload.get("name") or "").strip(), (payload.get("email") or "").strip()
    return f"{name} ({email})" if name and email else (name or email)


def peek_holder(data_dir):
    """Who the saved key is for, without checking it (only for the window title)."""
    try:
        body = clean_key_text(load_installed(data_dir))[len(KEY_PREFIX):].split(".", 1)[0]
        return holder(json.loads(_b64d(body).decode("utf-8")))
    except Exception:
        return ""


def days_left(payload, today=None):
    exp = payload.get("expires")
    if not exp:
        return None
    return (date.fromisoformat(exp) - (today or date.today())).days


# ---------- what is stored on the user's computer ----------

def load_installed(data_dir):
    p = os.path.join(data_dir, LICENCE_FILE)
    try:
        return open(p, encoding="utf-8").read()
    except OSError:
        return ""


def save_installed(data_dir, key_text):
    os.makedirs(data_dir, exist_ok=True)
    p = os.path.join(data_dir, LICENCE_FILE)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(clean_key_text(key_text) + "\n")
    os.replace(tmp, p)


def clock_moved_back(data_dir, today=None):
    """Remember the latest date the app was used; True if the clock is now well before it.
    This only stops the easy trick of turning the computer date back to stretch a key."""
    today = today or date.today()
    p = os.path.join(data_dir, STATE_FILE)
    last = None
    try:
        last = date.fromisoformat(json.load(open(p, encoding="utf-8")).get("last_seen", ""))
    except Exception:
        pass
    if last and (last - today).days > CLOCK_SLACK_DAYS:
        return True
    if last is None or today > last:
        try:
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"last_seen": today.isoformat(), "updated": datetime.now().isoformat(timespec="seconds")}, f)
        except OSError:
            pass
    return False


def check_installed(data_dir, public_key_b64, revoked=()):
    """Return (ok, payload_or_None, message) for the key saved on this computer."""
    text = load_installed(data_dir)
    if not text.strip():
        return False, None, ""
    payload, err = read_key(text, public_key_b64)
    if err:
        return False, None, err
    ok, msg = check_payload(payload, revoked)
    if ok and payload.get("expires") and clock_moved_back(data_dir):
        return False, payload, ("The date on this computer looks wrong (it is earlier than the last time TAMA was used). "
                                "Please correct the date and time in Windows settings, then open TAMA again.")
    return ok, payload, msg
