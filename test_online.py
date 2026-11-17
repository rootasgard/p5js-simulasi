import base64, urllib.request, json

def test(mermaid_text):
    data = json.dumps({'code': mermaid_text})
    b64 = base64.urlsafe_b64encode(data.encode('utf-8')).decode('ascii')
    url = f'https://mermaid.ink/svg/{b64}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8')
            return True, content
    except urllib.error.HTTPError as e:
        return False, f'HTTP {e.code}: {e.read().decode("utf-8")}'
    except Exception as e:
        return False, str(e)

clean_mermaid = """flowchart TD
    A(["Terminal: Mulai"]) --> B["Tetapkan konstanta<br/>g = 9,8 m/s²"]
    B --> C[/"Input:<br/>Kecepatan awal v₀ dalam m/s<br/>Koefisien gesek μ<br/>Jarak ke dinding d dalam meter"/]
    C --> D{"Apakah v₀ ≥ 0,<br/>μ > 0, dan d > 0?"}
    D -->|Tidak| E["Periksa input kembali"]
    E --> C
    D -->|Ya| F["Konversi kecepatan"]
    F --> G["Hitung besar perlambatan<br/>a = μ × g"]
    G --> H["Hitung jarak pengereman<br/>s = v₀² / 2a"]
    H --> I{"Apakah s ≤ d?"}
    I -->|Ya| J["Kecepatan akhir vₐ = 0<br/>Hitung sisa jarak d - s"]
    J --> K[/"Output:<br/>Berhenti tanpa benturan<br/>Jarak pengereman s<br/>Sisa jarak d - s"/]
    I -->|Tidak| L["Hitung kecepatan benturan<br/>v_b = √(v₀² - 2ad)"]
    L --> M[/"Output:<br/>Terjadi benturan<br/>Jarak pengereman yang dibutuhkan s<br/>Kecepatan benturan v_b"/]
    K --> N(["Terminate: Selesai"])
    M --> N

    classDef terminal fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px
    classDef process fill:#fef3c7,stroke:#d97706,stroke-width:2px
    classDef io fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    classDef decision fill:#fce7f3,stroke:#db2777,stroke-width:2px
    classDef error fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    class A,N terminal
    class B,F,G,H,J,L process
    class C,K,M io
    class D,I decision
    class E error
"""

ok, res = test(clean_mermaid)
print('CLEAN QUOTED VERSION SUCCESS:', ok)
if ok:
    print('SVG length:', len(res))
    # Save the SVG so we can also embed or use it!
    with open('flowchart.svg', 'w', encoding='utf-8') as f:
        f.write(res)
else:
    print('Error message:', res)
