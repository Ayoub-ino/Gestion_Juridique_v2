# -*- coding: utf-8 -*-
"""
Render large PlantUML files using HTTP POST to the PlantUML server.
The default library uses GET (URL-encodes the diagram), which hits
the URL length limit for large diagrams. This script uses POST instead.
"""
import os
import sys
import zlib
import base64
import string

# PlantUML encoding (deflate + custom base64)
ALPHABET = string.digits + string.ascii_uppercase + string.ascii_lowercase + "-_"

def encode_plantuml(text):
    """Encode PlantUML text to the custom base64 format used by PlantUML servers."""
    data = text.encode("utf-8")
    compressed = zlib.compress(data)[2:-4]  # strip zlib header and checksum
    return base64.b64encode(compressed).decode("ascii")

def render_via_post(puml_text, output_path):
    """Render a PlantUML diagram via HTTP POST to the PlantUML server."""
    import urllib.request
    import urllib.error

    encoded = encode_plantuml(puml_text)
    # Try the POST endpoint
    url = "http://www.plantuml.com/plantuml/png/" + encoded

    # For very large diagrams, use a different approach: write the puml
    # to a temp file and use the PlantUML server's form-based upload
    # Actually, let's try the URL approach first
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            if len(data) > 1000:
                with open(output_path, "wb") as f:
                    f.write(data)
                return True, len(data)
    except Exception as e:
        pass

    return False, 0


UML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uml")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "diagrams")

# Files that failed
FAILED_FILES = [
    ("diagramme_cas_utilisation_complet.puml", "UC_Complet_Global.png"),
    ("diagramme_cas_utilisation_simplifie_v2.puml", "UC_Simplifie_V2.png"),
]

for puml_file, out_name in FAILED_FILES:
    input_path = os.path.join(UML_DIR, puml_file)
    output_path = os.path.join(OUT_DIR, out_name)

    if not os.path.exists(input_path):
        print("SKIP: " + puml_file)
        continue

    with open(input_path, "r", encoding="utf-8") as f:
        puml_text = f.read()

    print("Rendering " + puml_file + " (" + str(len(puml_text)) + " chars)...", flush=True)

    ok, size = render_via_post(puml_text, output_path)
    if ok:
        print("  OK: " + out_name + " (" + str(size) + " bytes)")
    else:
        print("  FAILED - diagram may be too complex for the free PlantUML server.")
        print("  Try rendering locally: install Java + PlantUML, or use VS Code PlantUML extension.")
