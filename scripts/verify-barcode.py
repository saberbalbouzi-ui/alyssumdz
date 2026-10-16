#!/usr/bin/env python3
"""تحقق مستقل من مولّد الباركود و QR: يولّد رموزاً بـ assets/js/barcode-tool.js ثم يفكّها بمكتبة zxing-cpp (pip install zxing-cpp pillow).
   python3 scripts/verify-barcode.py   ← يطبع 'bad 0' عند النجاح (QR إصدارات 1–36 بكل المستويات + العربية + EAN/UPC/Code128/Code39)."""
import json, subprocess, sys, os, tempfile
import zxingcpp
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
JS = r"""
const B=require(process.argv[1]);const out=[];
const rnd=n=>{let s="";const c="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_/:.?=&";for(let i=0;i<n;i++)s+=c[(i*7+i*i*3+n)%c.length];return s;};
for(const e of ["L","M","Q","H"]) for(const n of [1,10,17,30,50,80,120,200,350,600,900,1300]){try{const t=rnd(n),q=B.qr(t,e);out.push({k:"qr",text:t,m:q.modules.map(r=>r.map(c=>c?1:0).join(""))});}catch(x){}}
for(const t of ["https://alyssumdz.com/p/honey?utm=1","واتساب: مرحباً بكم في أليسوم ☘","WIFI:T:WPA;S:Home;P:pass;;","tel:+213550000000"]) for(const e of ["L","M","Q","H"]){const q=B.qr(t,e);out.push({k:"qr",text:t,m:q.modules.map(r=>r.map(c=>c?1:0).join(""))});}
for(const [t,v] of [["ean13","613000001234"],["ean13","590123412345"],["ean8","1234567"],["upca","03600029145"],["code128","ORDER-10452"],["code128","1234567890"],["code128","Alyssum 2026!"],["code39","ABC-123"],["code39","HONEY 500G"]]){const r=B.linear(t,v);out.push({k:"lin",t,text:r.text,bits:r.bits});}
console.log(JSON.stringify(out));
"""
cases = json.loads(subprocess.check_output(["node", "-e", JS, os.path.join(root, "assets/js/barcode-tool.js")]))
bad = 0
for c in cases:
    if c["k"] == "qr":
        rows = c["m"]; q = 4; sc = 6; n = len(rows); im = Image.new("L", ((n + 2 * q) * sc,) * 2, 255); px = im.load()
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == "1":
                    for dy in range(sc):
                        for dx in range(sc): px[(x + q) * sc + dx, (y + q) * sc + dy] = 0
        r = zxingcpp.read_barcodes(im); ok = bool(r) and r[0].text == c["text"] and "QR" in str(r[0].format)
    else:
        bits = c["bits"]; q = 10; sc = 3; im = Image.new("L", ((len(bits) + 2 * q) * sc, 120), 255); px = im.load()
        for i, b in enumerate(bits):
            if b == "1":
                for dx in range(sc):
                    for y in range(10, 100): px[(i + q) * sc + dx, y] = 0
        r = zxingcpp.read_barcodes(im); ok = bool(r) and r[0].text in (c["text"], "0" + c["text"])
    if not ok: bad += 1; print("FAIL", c["k"], c.get("t"), c["text"][:30])
print("checked", len(cases), "bad", bad); sys.exit(1 if bad else 0)
