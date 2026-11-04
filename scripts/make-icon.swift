// Draws the Strudy app icon (a study timer ring around a play button) as a 1024x1024 PNG.
// Usage: swift scripts/make-icon.swift <out.png>
// scripts/make-icns.sh turns it into build/icon.icns.
import AppKit
import CoreGraphics

let size = 1024
let outPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon-1024.png"
let space = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { fatalError("no graphics context") }

// The macOS icon shape: a rounded square inset from the edge, with a soft shadow.
let rect = CGRect(x: 100, y: 100, width: 824, height: 824)
let shape = CGPath(roundedRect: rect, cornerWidth: 190, cornerHeight: 190, transform: nil)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -16), blur: 30, color: CGColor(gray: 0, alpha: 0.4))
ctx.addPath(shape)
ctx.setFillColor(CGColor(red: 0.3, green: 0.38, blue: 0.85, alpha: 1))
ctx.fillPath()
ctx.restoreGState()

ctx.saveGState()
ctx.addPath(shape)
ctx.clip()
let colors = [
    CGColor(red: 0.50, green: 0.62, blue: 1.00, alpha: 1),
    CGColor(red: 0.26, green: 0.33, blue: 0.80, alpha: 1),
] as CFArray
let gradient = CGGradient(colorsSpace: space, colors: colors, locations: [0, 1])!
ctx.drawLinearGradient(gradient, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])
ctx.restoreGState()

// The timer ring: most of a circle, starting at the top and running clockwise.
let center = CGPoint(x: 512, y: 512)
ctx.setStrokeColor(CGColor(gray: 1, alpha: 1))
ctx.setLineWidth(62)
ctx.setLineCap(.round)
ctx.addArc(center: center, radius: 268, startAngle: .pi / 2, endAngle: .pi / 2 - 300 * .pi / 180, clockwise: true)
ctx.strokePath()

// The play triangle, slightly right of centre so it looks centred.
ctx.setFillColor(CGColor(gray: 1, alpha: 1))
ctx.setStrokeColor(CGColor(gray: 1, alpha: 1))
ctx.setLineWidth(34)
ctx.setLineJoin(.round)
let triangle = CGMutablePath()
triangle.move(to: CGPoint(x: 462, y: 408))
triangle.addLine(to: CGPoint(x: 462, y: 616))
triangle.addLine(to: CGPoint(x: 640, y: 512))
triangle.closeSubpath()
ctx.addPath(triangle)
ctx.drawPath(using: .fillStroke)

guard let image = ctx.makeImage() else { fatalError("no image") }
let bitmap = NSBitmapImageRep(cgImage: image)
guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("no png") }
try png.write(to: URL(fileURLWithPath: outPath))
print("wrote \(outPath)")
