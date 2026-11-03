# Test app for the Mac build check: imports the same libraries as the real TAMA app.
import os
from pathlib import Path
import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
import openpyxl
import docx
import reportlab
from reportlab.pdfbase import pdfmetrics
import pdfplumber
import pypdf
import pypdfium2
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image
import anthropic

DATA_FILE = Path(os.path.abspath(__file__)).with_name("app_data.json")
st.set_page_config(page_title="TAMA test", layout="wide")
st.title("TAMA Mac test build")
st.write("Data file:", str(DATA_FILE))
st.dataframe(pd.DataFrame({"a": np.arange(3)}))
for reg, bld in [("C:\\Windows\\Fonts\\arial.ttf", "C:\\Windows\\Fonts\\arialbd.ttf"), ("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf"),
                 ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")]:
    pass
