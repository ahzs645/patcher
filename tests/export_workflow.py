"""Run against a local Patcher dev or preview server with Python Playwright and Chromium.

    python tests/export_workflow.py http://127.0.0.1:5173
"""

import argparse
import re
import shutil
from xml.etree import ElementTree

from playwright.sync_api import expect, sync_playwright


ART = b"""<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90">
<rect x="2" y="55" width="30" height="30" fill="red"/>
</svg>"""


def download(page, kind):
    with page.expect_download() as pending:
        page.locator(f'[data-export="{kind}"]').click()
    return pending.value.path().read_bytes()


def endpoint(records):
    # Decode the four movement bits in each byte with their DST positional weights.
    x, y = 0, 0
    for a, b, c in records:
        if c in (0xC3, 0xF3):
            continue
        for value, pos, neg, weight in ((c, 2, 3, 81), (b, 2, 3, 27), (a, 2, 3, 9),
                                        (b, 0, 1, 3), (a, 0, 1, 1)):
            x += weight * (((value >> pos) & 1) - ((value >> neg) & 1))
        for value, pos, neg, weight in ((c, 5, 4, 81), (b, 5, 4, 27), (a, 5, 4, 9),
                                        (b, 7, 6, 3), (a, 7, 6, 1)):
            y += weight * (((value >> pos) & 1) - ((value >> neg) & 1))
    return x, y


def header_value(data, field):
    match = re.search(rb"(?:^|\r)" + field + rb":([+\- 0-9]+)\r", data[:512])
    return int(match[1].replace(b" ", b""))


def check_export(page):
    page.locator("#file").set_input_files({"name": "Doctype.svg", "mimeType": "image/svg+xml", "buffer": ART})
    expect(page.locator("#docName")).to_have_text("Doctype")
    expect(page.locator("#sizeInfo")).to_contain_text("Artwork size 90 × 90 mm")
    page.wait_for_function("document.querySelector('#svgImg').naturalWidth > 0")
    page.locator('[data-tab="stitches"]').click()
    page.locator("#borderAuto").uncheck()
    page.locator("#borderColor").evaluate("""el => {
      el.value = '#00ff00';
      el.dispatchEvent(new Event('input'));
    }""")
    page.locator("#exportBtn").click()
    expect(page.locator("#sequence li")).to_have_count(2)
    expect(page.locator("#details")).to_contain_text("Color changes1")
    expect(page.locator("#details")).to_contain_text("Stitched size")
    assert ElementTree.fromstring(download(page, "svg")).tag == "{http://www.w3.org/2000/svg}svg"
    data = download(page, "dst")
    records = list(zip(*[iter(data[512:])] * 3, strict=True))
    assert header_value(data, b"CO") == sum(r == (0, 0, 0xC3) for r in records) == 1
    x, y = endpoint(records)
    assert x < 0 and y < 0
    assert (header_value(data, b"AX"), header_value(data, b"AY")) == (x, y)
    assert download(page, "exp").count(b"\x80\x01\x00\x00") == 1

    stale_buttons = page.locator("#widthMm").evaluate("""slider => {
      slider.value = '150';
      slider.dispatchEvent(new Event('input'));
      return [...document.querySelectorAll('[data-export]')].filter(b => !b.disabled).length;
    }""")
    assert stale_buttons == 0
    expect(page.locator('[data-export="dst"]')).to_be_enabled(timeout=30000)
    large = download(page, "dst")
    assert header_value(large, b"ST") > header_value(data, b"ST")


def check_selection(page):
    page.locator('[data-tab="art"]').click()
    pending = []
    page.route("**/samples/state-trooper.svg", lambda route: pending.append(route))
    page.locator('[title="State trooper seal"]').click()
    page.locator('[title="K-9 unit"]').click()
    expect(page.locator("#docName")).to_have_text("K-9 unit")
    # Release the older request after the second design has loaded.
    with page.expect_event("requestfinished", predicate=lambda req: req.url.endswith("/state-trooper.svg")):
        pending[0].fulfill(content_type="image/svg+xml", body=ART)
    page.wait_for_function("!document.querySelector('[data-export=dst]').disabled", timeout=60000)
    expect(page.locator("#docName")).to_have_text("K-9 unit")


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("url")
    args.add_argument("--chromium", default=shutil.which("chromium"))
    options = args.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=options.chromium)
        page = browser.new_page()
        page.goto(options.url)
        page.wait_for_function("document.querySelector('#details').childElementCount > 0", timeout=60000)
        check_export(page)
        check_selection(page)
        browser.close()
    print("Passed SVG, thread stops, DST endpoint, sizing, export freshness and artwork selection checks.")
