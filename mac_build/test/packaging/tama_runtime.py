"""Runs inside the packaged TAMA app on every page load.

1. Checks the licence key saved on this computer. Without a good key it shows the
   activation page and stops, so the app itself never starts.
2. With a good key it runs the real app (app.py, packed into the program as app.bin),
   telling it that its file lives in the user's data folder. app.py keeps app_data.json
   "next to itself", so the data ends up in that folder and never in the program folder.
"""
import marshal
import os

import streamlit as st

import tama_build_info as info
import tama_licence as lic

_APP_CODE = None


def data_dir():
    return os.environ.get("TAMA_DATA_DIR") or os.path.join(os.path.expanduser("~"), "TAMA")


def _app_code():
    global _APP_CODE
    if _APP_CODE is None:
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "app.bin"), "rb") as f:
            _APP_CODE = marshal.load(f)
    return _APP_CODE


def _page_config_anywhere():
    try:
        major, minor = (int(x) for x in st.__version__.split(".")[:2])
        return (major, minor) >= (1, 46)
    except Exception:
        return False


def _form_fields(link):
    """From a Google Form pre-filled link whose answers are the words NAME, EMAIL, ORG and CODE,
    work out where to send the answers and which entry each word belongs to."""
    from urllib.parse import parse_qsl, urlsplit
    u = urlsplit(link.strip())
    if "docs.google.com" not in u.netloc or "/forms/" not in u.path:
        return None, {}
    post = f"{u.scheme}://{u.netloc}{u.path.rsplit('/', 1)[0]}/formResponse"
    fields = {v.strip().upper(): k for k, v in parse_qsl(u.query) if k.startswith("entry.")}
    return post, fields


def _send_to_form(link, values):
    import urllib.parse
    import urllib.request
    post, fields = _form_fields(link)
    if not post or not fields:
        return False
    data = {fields[k]: v for k, v in values.items() if k in fields}
    req = urllib.request.Request(post, data=urllib.parse.urlencode(data).encode("utf-8"),
                                 headers={"User-Agent": "TAMA"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except Exception:
        return False


def _request_section():
    import urllib.parse
    code = lic.machine_code()
    to = getattr(info, "CONTACT_EMAIL", "") or ""
    link = getattr(info, "FORM_LINK", "") or ""
    st.subheader("1. Ask for your licence key")
    st.write("Fill in your details and click **Send my request**. You will receive your licence key by e-mail"
             + (f" from {to}." if to else "."))
    st.caption("Want to use TAMA on more than one of your computers? Send a request from each computer; "
               "you will get one key that works on all of them.")
    with st.form("tama_request"):
        name = st.text_input("Your full name *")
        email = st.text_input("Your university e-mail *", placeholder="name@university.edu.sa")
        org = st.text_input("University / college / department")
        st.text_input("This computer's code (filled in for you)", value=code, disabled=True)
        sent = st.form_submit_button("Send my request", type="primary")
    body = (f"Name: {name}\nUniversity e-mail: {email}\nUniversity / department: {org}\nComputer code: {code}\n")
    if sent:
        if not name.strip() or "@" not in email:
            st.error("Please type your name and your university e-mail.")
        elif link and _send_to_form(link, {"NAME": name.strip(), "EMAIL": email.strip(), "ORG": org.strip(), "CODE": code}):
            st.success("Your request was sent. You will receive your licence key by e-mail; then paste it below.")
            return
        else:
            if link:
                st.warning("The request could not be sent from here (is the internet connected?). "
                           "Please send it by e-mail instead:")
            if to:
                mailto = f"mailto:{to}?" + urllib.parse.urlencode(
                    {"subject": "TAMA licence key request", "body": body}, quote_via=urllib.parse.quote)
                st.link_button(f"Open my e-mail to send the request to {to}", mailto, type="primary")
                st.caption(f"If no e-mail opens, send these details to {to} yourself:")
            st.code(body, language=None)


def _activation_page(message, payload):
    st.set_page_config(page_title="Activate TAMA", page_icon="🎓", layout="centered")
    st.title("🎓 Activate TAMA")
    if not st.session_state.get("_tama_renewing"):
        st.write("This copy of TAMA needs a licence key before it can be used.")
    if message:
        st.error(message)
    elif payload and st.session_state.get("_tama_renewing"):
        left = lic.days_left(payload)
        st.info(f"TAMA is activated on this computer for {lic.holder(payload)}"
                + (f" (the key runs out in {left} day(s))." if left is not None else " (the key does not run out).")
                + " You can paste a new key below to replace it.")
        if st.button("Keep my current key and open TAMA"):
            del st.query_params["licence"]
            st.rerun()
    _request_section()
    st.subheader("2. Paste the licence key you received")
    key = st.text_area("Licence key", height=120, placeholder="TAMA-....", label_visibility="collapsed")
    if st.button("Activate", type="primary"):
        p, err = lic.read_key(key, info.PUBLIC_KEY)
        if err:
            st.error(err)
        else:
            ok, msg = lic.check_payload(p, info.REVOKED)
            if not ok:
                st.error(msg)
            else:
                lic.save_installed(data_dir(), key)
                st.success(f"Thank you, {lic.holder(p) or 'TAMA is activated'}! Opening TAMA ...")
                if "licence" in st.query_params:
                    del st.query_params["licence"]
                st.rerun()
    st.divider()
    st.caption(f"TAMA version {info.APP_VERSION}. Your data folder: {data_dir()}")


def run(g):
    ok, payload, message = lic.check_installed(data_dir(), info.PUBLIC_KEY, info.REVOKED)
    if not ok or "licence" in st.query_params:
        if ok:
            message = ""
            st.session_state["_tama_renewing"] = True
        _activation_page(message, payload)
        st.stop()

    left = lic.days_left(payload)
    if left is not None and left <= lic.WARN_DAYS and _page_config_anywhere() and not st.session_state.get("_tama_warned"):
        st.session_state["_tama_warned"] = True
        st.toast(f"Your TAMA licence runs out in {left} day(s). Ask Dania for a renewed key.", icon="⏳")

    g["__file__"] = os.path.join(data_dir(), "app.py")
    exec(_app_code(), g)
