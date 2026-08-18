#!/usr/bin/env python3
"""
ui_tap.py — clique sur un élément de l'UI Android dont le texte contient une chaîne.

Usage :
    python3 ui_tap.py "<texte recherché>" [index] [fichier_ui.xml]

Exemples :
    python3 ui_tap.py "Réglages"
    python3 ui_tap.py "Contacts d'urgence" 2
    python3 ui_tap.py "Ajouter" 0 ui_contacts.xml

Fonctionnement :
    1. dump uiautomator → XML (ou utilise le fichier fourni)
    2. cherche le nœud dont text/content-desc contient la chaîne
    3. calcule le centre du bounds [x1,y1][x2,y2]
    4. envoie `adb shell input tap x y`
"""
import re
import subprocess
import sys
import time

def get_bounds_center(node):
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return ((x1 + x2) // 2, (y1 + y2) // 2)

def main():
    if len(sys.argv) < 2:
        print("Usage: ui_tap.py <texte> [index] [fichier_ui.xml]")
        sys.exit(2)
    needle = sys.argv[1]
    index = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    ui_file = sys.argv[3] if len(sys.argv) > 3 else None

    if ui_file:
        data = open(ui_file, encoding="utf-8", errors="replace").read()
    else:
        subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml"],
                       capture_output=True)
        subprocess.run(["adb", "pull", "/sdcard/ui.xml", "/tmp/ui_tap.xml"],
                       capture_output=True)
        data = open("/tmp/ui_tap.xml", encoding="utf-8", errors="replace").read()

    matches = []
    for node in re.finditer(r'<node[^>]*/?>', data):
        n = node.group(0)
        text = re.search(r'text="([^"]*)"', n)
        desc = re.search(r'content-desc="([^"]*)"', n)
        t = text.group(1) if text else ""
        d = desc.group(1) if desc else ""
        if needle.lower() in (t + d).lower():
            matches.append(n)

    if not matches:
        print(f"❌ Élément « {needle} » introuvable dans l'UI")
        sys.exit(1)

    if index >= len(matches):
        index = len(matches) - 1

    node = matches[index]
    center = get_bounds_center(node)
    if not center:
        print("❌ bounds illisibles")
        sys.exit(1)

    print(f"✅ « {needle} » trouvé (match {index}) → clic {center}")
    subprocess.run(["adb", "shell", "input", "tap", str(center[0]), str(center[1])],
                   check=True)
    time.sleep(1)

if __name__ == "__main__":
    main()
