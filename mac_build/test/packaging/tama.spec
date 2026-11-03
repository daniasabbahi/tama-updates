# PyInstaller recipe for TAMA. Run it with build_windows.bat (or: pyinstaller --noconfirm tama.spec).
# The same recipe makes the Mac version (TAMA.app) when it runs on a Mac (GitHub does that, see
# mac_build/build-mac.yml); the parts marked "Mac" only apply there.
# It packs: the launcher (TAMA.exe), Streamlit and every library app.py imports, app.py itself
# (as app.bin), the public licence key, the list of withdrawn keys, the colour settings and the
# web address where TAMA looks for updates.
import ast
import datetime
import marshal
import os
import re
import sys

from PyInstaller.utils.hooks import collect_all, copy_metadata

HERE = os.path.abspath(SPECPATH)
IS_MAC = sys.platform == "darwin"
GEN = os.path.join(HERE, "build", "generated")
os.makedirs(GEN, exist_ok=True)

# ---- find app.py ----
candidates = [os.environ.get("TAMA_APP_PY", ""), os.path.join(HERE, "app.py"),
              os.path.join(HERE, "..", "app.py"), os.path.join(HERE, "..", "..", "app.py")]
APP_PY = next((os.path.abspath(p) for p in candidates if p and os.path.isfile(p)), None)
if not APP_PY:
    raise SystemExit("app.py was not found. Put the packaging folder next to app.py.")
app_src = open(APP_PY, encoding="utf-8").read()
if IS_MAC:
    # Mac: Arial lives in /System/Library/Fonts/Supplemental on current macOS; tell the PDF reports
    # (only inside the Mac program; app.py itself is not changed)
    app_src = app_src.replace('("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf")',
                              '("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"), '
                              '("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf")')
print("TAMA: packing", APP_PY)

# ---- licence settings ----
pub_file = os.path.join(HERE, "public_key.txt")
if not os.path.isfile(pub_file):
    raise SystemExit("public_key.txt is missing. Open the Key Maker once (it creates the keys and puts "
                     "public_key.txt in this folder), then build again.")
PUBLIC_KEY = open(pub_file, encoding="utf-8").read().strip()
rev_file = os.path.join(HERE, "revoked_keys.txt")
REVOKED = []
if os.path.isfile(rev_file):
    for line in open(rev_file, encoding="utf-8"):
        line = line.split("#", 1)[0].strip()
        if line:
            REVOKED.append(line)
# where installed copies look for updates, unless TAMA settings.txt has its own "update_url =" line
DEFAULT_UPDATE_URL = "https://github.com/daniasabbahi/tama-updates/releases/latest/download/tama-update.json"
SETTINGS = {"contact_email": "", "google_form_link": "", "update_url": DEFAULT_UPDATE_URL}
set_file = os.path.join(HERE, "TAMA settings.txt")
if os.path.isfile(set_file):
    for line in open(set_file, encoding="utf-8-sig"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            SETTINGS[k.strip().lower()] = v.strip()
# The version is the build date and time (e.g. 2026.11.05.1430), so every new build counts as newer
# and installed copies offer it as an update. "version = ..." in TAMA settings.txt overrides it.
# The Mac build gets the version of the Windows build it belongs to (TAMA_VERSION), so both match.
APP_VERSION = os.environ.get("TAMA_VERSION") or SETTINGS.get("version") or datetime.datetime.now().strftime("%Y.%m.%d.%H%M")
if not re.fullmatch(r"[0-9A-Za-z.\-]+", APP_VERSION):
    raise SystemExit("The version in TAMA settings.txt may only use letters, numbers, dots and dashes.")

with open(os.path.join(GEN, "tama_build_info.py"), "w", encoding="utf-8") as f:
    f.write("# Made by tama.spec at build time; do not edit.\n")
    f.write(f"PUBLIC_KEY = {PUBLIC_KEY!r}\n")
    f.write(f"REVOKED = {tuple(REVOKED)!r}\n")
    f.write(f"APP_VERSION = {APP_VERSION!r}\n")
    f.write(f"CONTACT_EMAIL = {SETTINGS['contact_email']!r}\n")
    f.write(f"FORM_LINK = {SETTINGS['google_form_link']!r}\n")
    f.write(f"UPDATE_URL = {SETTINGS['update_url']!r}\n")
    f.write(f"BUILT = {datetime.datetime.now().isoformat(timespec='seconds')!r}\n")

# app.py goes in as compiled code, not as readable source
with open(os.path.join(GEN, "app.bin"), "wb") as f:
    marshal.dump(compile(app_src, "app.py", "exec"), f)
with open(os.path.join(GEN, "version.txt"), "w", encoding="utf-8") as f:
    f.write(APP_VERSION + "\n")

# ---- libraries: Streamlit plus whatever app.py imports ----
MAC_PKGS = {"objc", "Foundation", "AppKit", "WebKit", "Quartz", "Security", "UniformTypeIdentifiers",
            "PyObjCTools", "CoreFoundation"} if IS_MAC else set()
tree = ast.parse(app_src)
app_imports = set()
for node in ast.walk(tree):
    if isinstance(node, ast.Import):
        app_imports |= {a.name.split(".")[0] for a in node.names}
    elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
        app_imports.add(node.module.split(".")[0])

datas, binaries = [], []
hiddenimports = ["webview", "tama_runtime", "tama_licence", "tama_build_info", "tama_update"] + sorted(app_imports & set(sys.stdlib_module_names))
# collect every package fully: Streamlit needs its web files, the others their data files
for pkg in sorted(app_imports - set(sys.stdlib_module_names) | {"streamlit", "altair", "pyarrow", "pydeck", "cryptography", "openpyxl", "xlrd",
                                                               "webview", "clr_loader", "pythonnet", "bottle", "proxy_tools"} | MAC_PKGS):
    if IS_MAC and pkg in ("clr_loader", "pythonnet"):
        continue  # Windows only
    try:
        __import__(pkg)
    except Exception:
        print("TAMA: (not installed, skipped)", pkg)
        continue
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hiddenimports += h + [pkg]
for dist in ["streamlit", "altair", "pandas", "numpy", "pyarrow", "pdfplumber", "pdfminer.six", "python-docx",
             "reportlab", "openpyxl", "pillow", "cryptography", "arabic-reshaper", "python-bidi"]:
    try:
        datas += copy_metadata(dist)
    except Exception:
        pass

# leave out folders the app never uses (Streamlit's AI-assistant notes, test suites); they only make
# paths too long for Windows and the program bigger
_skip = (os.sep + ".agents" + os.sep, os.sep + "tests" + os.sep, "/.agents/", "/tests/")
datas = [d for d in datas if not any(k in d[0] for k in _skip)]
with open(os.path.join(GEN, "tama_build_info.py"), "a", encoding="utf-8") as f:
    # for "TAMA --selftest" (Mac build check): the libraries app.py needs
    f.write(f"APP_IMPORTS = {tuple(sorted(app_imports - set(sys.stdlib_module_names)))!r}\n")
datas += [(os.path.join(GEN, "app.bin"), "."), (os.path.join(GEN, "version.txt"), "."),
          (os.path.join(HERE, "tama_start.py"), ".")]
# colours / theme: use the same .streamlit/config.toml that sits next to app.py, if there is one
cfg = os.path.join(os.path.dirname(APP_PY), ".streamlit", "config.toml")
if os.path.isfile(cfg):
    datas.append((cfg, ".streamlit"))

a = Analysis(
    [os.path.join(HERE, "tama_launcher.py")],
    pathex=[HERE, GEN],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "matplotlib", "IPython", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)
icon = os.path.join(HERE, "tama.ico")
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="TAMA",
    console=False,  # TAMA opens its own window; no black console window
    icon=icon if os.path.isfile(icon) else None,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="TAMA", upx=False)

if IS_MAC:
    # Mac: wrap it all into TAMA.app (the icon is turned into a Mac icon automatically)
    short = ".".join(APP_VERSION.split(".")[:3])
    app = BUNDLE(
        coll,
        name="TAMA.app",
        icon=icon if os.path.isfile(icon) else None,
        bundle_identifier="sa.edu.kau.tama",
        version=short,
        info_plist={
            "CFBundleName": "TAMA",
            "CFBundleDisplayName": "TAMA",
            "CFBundleShortVersionString": short,
            "CFBundleVersion": APP_VERSION,
            "LSMinimumSystemVersion": "11.0",
            "NSHighResolutionCapable": True,
            "NSHumanReadableCopyright": "Teaching, Assessment, Measuring Achievement - Dania Sabbahi",
            # TAMA's window shows the app that runs on this Mac only (http://localhost)
            "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
        },
    )
