"""Dismiss only the emulator's Pixel Launcher ANR; never hide an app ANR."""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def inspect_dialog(xml):
    root = ET.fromstring(xml)
    titles = [n.get('text', '') for n in root.iter('node')
              if n.get('resource-id') == 'android:id/alertTitle']
    if not any("isn't responding" in title for title in titles):
        return 0, None
    if titles != ["Pixel Launcher isn't responding"]:
        return 2, None
    for node in root.iter('node'):
        if node.get('resource-id') == 'android:id/aerr_close':
            match = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
            if match:
                x1, y1, x2, y2 = map(int, match.groups())
                if x2 > x1 and y2 > y1:
                    return 3, ((x1 + x2) // 2, (y1 + y2) // 2)
    return 2, None


def main():
    try:
        result, point = inspect_dialog(Path(sys.argv[1]).read_text())
    except (FileNotFoundError, ET.ParseError):
        return 0  # The bounded caller retries incomplete UI observations.
    if result == 2:
        print('Unexpected application/system ANR: refusing to dismiss it.')
    if result == 3:
        if '--dry-run' not in sys.argv:
            subprocess.run(['adb', '-s', 'emulator-5554', 'shell', 'input', 'tap',
                            str(point[0]), str(point[1])], check=True)
        print('Recognized Pixel Launcher ANR; closed the emulator launcher dialog.')
    return result


if __name__ == '__main__':
    sys.exit(main())
