#!/usr/bin/env python3
"""
ui_test.py — test UI complet de l'appli ANGi sur émulateur :
  1. écran d'accueil (vérification "START RIDE")
  2. Réglages → scroll → Emergency Contacts
  3. Ajout d'un contact (nom, téléphone, email) → sauvegarde
  4. Vérification que le contact apparaît dans la liste
  5. Réglages → "Envoyer ma position" (chemin SMS, échec attendu sans SIM mais loggé)
Rapport détaillé sur stdout (redirigé vers ui_test_out.txt par le workflow).
"""
import re, subprocess, sys, time

SERIAL = "emulator-5554"

def adb(*args):
    return subprocess.run(["adb", "-s", SERIAL] + list(args),
                          capture_output=True, text=True, errors="replace")

def dump():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    subprocess.run(["adb", "-s", SERIAL, "pull", "/sdcard/ui.xml", "/tmp/ui.xml"],
                   capture_output=True)
    try:
        return open("/tmp/ui.xml", encoding="utf-8", errors="replace").read()
    except Exception:
        return ""

def find_nodes(xml, needles):
    out = []
    for m in re.finditer(r'<node[^>]*/?>', xml):
        n = m.group(0)
        t = re.search(r'text="([^"]*)"', n)
        d = re.search(r'content-desc="([^"]*)"', n)
        s = (t.group(1) if t else "") + " | " + (d.group(1) if d else "")
        for needle in needles:
            if needle.lower() in s.lower():
                b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
                if b:
                    x1, y1, x2, y2 = map(int, b.groups())
                    out.append((needle, s.strip(), (x1 + x2) // 2, (y1 + y2) // 2))
                break
    return out

def tap_center(x, y):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(2)

def tap_first(xml, *needles):
    nodes = find_nodes(xml, list(needles))
    if nodes:
        needle, label, x, y = nodes[0]
        print(f"  ✅ TAP « {label[:60]} » ({needle}) à ({x},{y})")
        tap_center(x, y)
        return True
    print(f"  ❌ INTROUVABLE: {needles}")
    return False

def tap_bottom(xml, *needles):
    """Tape le match le PLUS BAS de l'écran (pour viser la bottom-nav)."""
    nodes = find_nodes(xml, list(needles))
    if nodes:
        # trier par y décroissant, prendre le plus bas
        nodes.sort(key=lambda n: n[3], reverse=True)
        needle, label, x, y = nodes[0]
        print(f"  ✅ TAP BAS « {label[:60]} » ({needle}) à ({x},{y})")
        tap_center(x, y)
        return True
    print(f"  ❌ INTROUVABLE (bas): {needles}")
    return False

def scroll_down(n=1):
    for _ in range(n):
        adb("shell", "input", "swipe", "540", "1800", "540", "500", "400")
        time.sleep(2)

def scroll_up(n=1):
    for _ in range(n):
        adb("shell", "input", "swipe", "540", "500", "540", "1800", "400")
        time.sleep(2)

def screenshot(name):
    subprocess.run(["adb", "-s", SERIAL, "exec-out", "screencap", "-p"],
                   stdout=open(name, "wb"))
    print(f"  📸 capture: {name}")

def type_text(text):
    # espaces -> %s, autres caractères spéciaux échappés
    safe = text.replace(" ", "%s")
    adb("shell", "input", "text", safe)
    time.sleep(1)

def texts(xml):
    return sorted({t for t in re.findall(r'text="([^"]+)"', xml)})

def main():
    print("========== TEST UI ANGi ==========")
    time.sleep(3)

    # --- 1. Écran d'accueil ---
    print("\n[1] Écran d'accueil")
    adb("shell", "am", "start", "-n",
        "com.starfleet.angi/com.specialized.ride.android.MainActivity")
    time.sleep(20)
    xml = dump()
    print("  Textes visibles:", texts(xml))
    screenshot("01_accueil.png")
    if "START RIDE" in xml:
        print("  ✅ Écran d'accueil ANGi OK (START RIDE)")
    else:
        print("  ⚠️ START RIDE non trouvé — vérifier captures")

    # --- 2. Réglages (bottom-nav) ---
    print("\n[2] Réglages (bottom-nav)")
    xml = dump()
    if not tap_bottom(xml, "ettings", "Settings"):
        tap_first(xml, "ettings", "Settings")
    time.sleep(6)
    xml = dump()
    print("  Textes:", texts(xml))
    screenshot("02_reglages_haut.png")
    # Vérifier qu'on est bien sur l'écran des réglages ANGi (Emergency Contacts / countdown)
    # sinon revenir et essayer l'autre bouton Settings
    if "mergency" not in xml and "ountdown" not in xml:
        print("  ⚠️ Écran de réglages ANGi non détecté — back puis autre Settings")
        adb("shell", "input", "keyevent", "4")
        time.sleep(4)
        xml = dump()
        if not tap_first(xml, "ettings", "Settings"):
            tap_bottom(xml, "ettings", "Settings")
        time.sleep(6)
        xml = dump()
        print("  Textes (2e essai):", texts(xml))
        screenshot("02b_reglages_essai2.png")

    # scroll jusqu'à Emergency Contacts (max 8)
    print("\n[3] Scroll vers Emergency Contacts")
    found = False
    for i in range(8):
        xml = dump()
        if "mergency" in xml or "ontact" in xml or "ountdown" in xml or "Envoyer" in xml:
            found = True
            break
        scroll_down()
    print(f"  {'✅ trouvé après ' + str(i) + ' scroll(s)' if found else '❌ pas trouvé après 8 scrolls'}")
    screenshot("03_reglages_apres_scroll.png")
    xml = dump()
    tap_first(xml, "mergency", "ontact", "Emergency Contacts")
    time.sleep(6)
    xml = dump()
    print("  Écran contacts textes:", texts(xml))
    screenshot("04_contacts.png")

    # --- 3. Ajouter un contact ---
    print("\n[4] Ajout d'un contact")
    xml = dump()
    if not tap_first(xml, "ADD EMERGENCY", "ADD CONTACT", "dd emergency"):
        print("  ❌ bouton ADD EMERGENCY CONTACTS introuvable")
    time.sleep(6)
    xml = dump()
    print("  Formulaire textes:", texts(xml))
    screenshot("05_formulaire.png")

    # Remplir : First Name, Last Name, Phone, Email
    fields = [("first", "Test"), ("last", "Urgence"), ("phone", "2125551234"), ("email", "test@example.com")]
    for key, val in fields:
        xml = dump()
        if not tap_first(xml, key):
            # chercher le hint exact
            nodes = find_nodes(xml, [key])
            if not nodes:
                print(f"  ⚠️ champ {key} introuvable, on continue")
                continue
        time.sleep(1)
        type_text(val)
        print(f"  ✍️ {key} = {val}")
    screenshot("06_formulaire_rempli.png")

    # Sauvegarder
    xml = dump()
    if not tap_first(xml, "ave", "Save", "save"):
        # bouton en bas — scroll léger
        scroll_up(1)
        xml = dump()
        tap_first(xml, "ave", "Save", "save")
    time.sleep(6)

    # --- 4. Vérifier la liste ---
    print("\n[5] Vérification liste contacts")
    xml = dump()
    print("  Textes après sauvegarde:", texts(xml))
    screenshot("07_liste_apres_ajout.png")
    if "Test" in xml or "Urgence" in xml:
        print("  ✅ Contact ajouté visible dans la liste")
    else:
        print("  ⚠️ Contact non visible — vérifier captures + journal")

    # --- 5. Réglages → Envoyer ma position ---
    print("\n[6] Réglages → Envoyer ma position")
    # relancer l'app proprement (les backs peuvent avoir quitté l'app)
    adb("shell", "am", "start", "-n",
        "com.starfleet.angi/com.specialized.ride.android.MainActivity")
    time.sleep(12)
    xml = dump()
    tap_bottom(xml, "ettings", "Settings")
    time.sleep(6)
    found = False
    for i in range(6):
        xml = dump()
        if "osition" in xml or "Envoyer" in xml:
            found = True
            break
        scroll_down()
    if found:
        tap_first(xml, "osition", "Envoyer")
        time.sleep(5)
        print("  ✅ Clic « Envoyer ma position » (SMS tenté — journal attendu)")
    else:
        print("  ❌ « Envoyer ma position » introuvable")
        print("  Textes visibles:", texts(xml))
    screenshot("08_position.png")

    # --- 6. Journal de l'app ---
    print("\n[7] Journal ANGi (Téléchargements)")
    r = adb("shell", "cat", "/sdcard/Download/ANGi_debug.log.txt")
    print(r.stdout[-3000:] if r.stdout else "(vide)")

    print("\n========== FIN TEST UI ==========")

if __name__ == "__main__":
    main()
