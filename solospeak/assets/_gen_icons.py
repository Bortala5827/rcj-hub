import struct, zlib, os

def make_png(path, size, bg, fg):
    raw = bytearray()
    cx = cy = size // 2
    r_outer = size * 0.34
    r_inner = size * 0.16
    for y in range(size):
        raw.append(0)  # filter type 0
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= r_outer and dist >= r_inner:
                raw += bytes(fg)
            else:
                raw += bytes(bg)
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
        return c
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

here = os.path.dirname(os.path.abspath(__file__))
make_png(os.path.join(here, 'icon-192.png'), 192, (244, 241, 236), (176, 122, 91))
make_png(os.path.join(here, 'icon-512.png'), 512, (244, 241, 236), (176, 122, 91))
print('icons generated')
