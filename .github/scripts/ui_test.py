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

    # --- 2. Réglages ---
    print("\n[2] Réglages")
    xml = dump()
    tap_first(xml, "ettings", "Settings")
    time.sleep(6)
    xml = dump()
    print("  Textes:", texts(xml))
    screenshot("02_reglages_haut.png")

    # scroll jusqu'à Emergency Contacts (max 8)
    print("\n[3] Scroll vers Emergency Contacts")
    found = False
    for i in range(8):
        xml = dump()
        if "mergency" in xml or "ontact" in xml:
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
    if not tap_first(xml, "dd emergency", "dd contact", "dd", "+", "Add"):
        # essayer un FAB éventuel : dernier node clickable en bas à droite
        print("  ⚠️ bouton d'ajout non trouvé — essai FAB")
        nodes = find_nodes(xml, [""])
        cand = [n for n in nodes if "dd" in n[1].lower() or n[1].strip() == "|"]
        if cand:
            tap_center(cand[-1][2], cand[-1][3])
        else:
            print("  ❌ impossible d'ouvrir le formulaire")
    time.sleep(5)
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

    # --- 5. Retour réglages → Envoyer ma position ---
    print("\n[6] Réglages → Envoyer ma position")
    adb("shell", "input", "keyevent", "4")  # back
    time.sleep(3)
    adb("shell", "input", "keyevent", "4")
    time.sleep(3)
    xml = dump()
    found = False
    for i in range(8):
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
    screenshot("08_position.png")

    # --- 6. Journal de l'app ---
    print("\n[7] Journal ANGi (Téléchargements)")
    r = adb("shell", "cat", "/sdcard/Download/ANGi_debug.log.txt")
    print(r.stdout[-3000:] if r.stdout else "(vide)")

    print("\n========== FIN TEST UI ==========")

if __name__ == "__main__":
    main()
