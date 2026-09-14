# -*- coding: utf-8 -*-
"""
Render PlantUML files (.puml) to PNG via the PlantUML web service.
Requires: pip install plantuml
"""
import os
import plantuml

UML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uml")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "diagrams")
os.makedirs(OUT_DIR, exist_ok=True)

# All PlantUML files to render
PUML_FILES = [
    "diagramme_cas_utilisation_complet.puml",
    "diagramme_par_service.puml",
    "diagramme_admin.puml",
    "matrice_permissions.puml",
    "diagramme_cas_utilisation_simplifie_v2.puml",
    "diagramme_cas_utilisation.puml",
    "diagramme_cas_utilisation_simplifie.puml",
]

# Nice names for output
OUTPUT_NAMES = {
    "diagramme_cas_utilisation_complet.puml": "UC_Complet_Global.png",
    "diagramme_par_service.puml": "UC_Par_Service_RBAC.png",
    "diagramme_admin.puml": "UC_Administrateur_RBAC.png",
    "matrice_permissions.puml": "Matrice_Permissions_RBAC.png",
    "diagramme_cas_utilisation_simplifie_v2.puml": "UC_Simplifie_V2.png",
    "diagramme_cas_utilisation.puml": "UC_Complet_Original.png",
    "diagramme_cas_utilisation_simplifie.puml": "UC_Simplifie_Original.png",
}

# Use a PlantUML server (public, no auth needed)
puml = plantuml.PlantUML(url="http://www.plantuml.com/plantuml/uml/")

success = []
failed = []

for puml_file in PUML_FILES:
    input_path = os.path.join(UML_DIR, puml_file)
    output_name = OUTPUT_NAMES.get(puml_file, puml_file.replace(".puml", ".png"))
    output_path = os.path.join(OUT_DIR, output_name)

    if not os.path.exists(input_path):
        print("SKIP (not found): " + puml_file)
        failed.append(puml_file)
        continue

    print("Rendering " + puml_file + " -> " + output_name + " ...", end=" ", flush=True)
    try:
        result = puml.processes_file(input_path, outfile=output_path)
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            if size > 1000:
                print("OK (" + str(size) + " bytes)")
                success.append(puml_file)
            else:
                print("FAILED (output too small: " + str(size) + " bytes)")
                failed.append(puml_file)
        else:
            print("FAILED (no output file)")
            failed.append(puml_file)
    except Exception as e:
        print("FAILED (" + str(e) + ")")
        failed.append(puml_file)

print("\n=== Results ===")
print("Success: " + str(len(success)) + "/" + str(len(PUML_FILES)))
for f in success:
    print("  OK: " + f)
if failed:
    print("Failed: " + str(len(failed)))
    for f in failed:
        print("  FAIL: " + f)
