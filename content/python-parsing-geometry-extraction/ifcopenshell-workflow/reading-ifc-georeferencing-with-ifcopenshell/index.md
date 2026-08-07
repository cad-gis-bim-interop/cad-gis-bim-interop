---
title: "Reading IFC Georeferencing with ifcopenshell"
description: "Read IfcMapConversion and IfcProjectedCRS with ifcopenshell, build the map transform from eastings, northings, rotation and scale, and fall back to IfcSite."
slug: "reading-ifc-georeferencing-with-ifcopenshell"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ifcopenshell Workflow"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/"
  - label: "Reading IFC Georeferencing with ifcopenshell"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Reading IFC Georeferencing with ifcopenshell",
      "description": "Read IfcMapConversion and IfcProjectedCRS with ifcopenshell, build the map transform from eastings, northings, rotation and scale, and fall back to IfcSite.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ifcopenshell Workflow", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/"},
        {"@type": "ListItem", "position": 3, "name": "Reading IFC Georeferencing with ifcopenshell", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Reading IFC Georeferencing with ifcopenshell",
      "description": "Read the IFC map conversion and projected CRS, then transform local coordinates to projected eastings and northings.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Locate the map conversion", "text": "Query IfcMapConversion and its TargetCRS IfcProjectedCRS, reachable from the model's geometric representation context."},
        {"@type": "HowToStep", "position": 2, "name": "Read the parameters", "text": "Read Eastings, Northings, OrthogonalHeight, XAxisAbscissa, XAxisOrdinate, and Scale from the map conversion."},
        {"@type": "HowToStep", "position": 3, "name": "Derive the rotation", "text": "Compute the grid rotation as atan2(XAxisOrdinate, XAxisAbscissa)."},
        {"@type": "HowToStep", "position": 4, "name": "Transform coordinates", "text": "Apply rotation, scale, and the eastings/northings offset to map local X, Y, Z to projected E, N, H."},
        {"@type": "HowToStep", "position": 5, "name": "Fall back for IFC2x3", "text": "When no map conversion exists, read IfcSite RefLatitude and RefLongitude and convert the degrees-minutes-seconds tuples to decimal degrees."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does my IFC2x3 file have no IfcMapConversion?",
          "acceptedAnswer": {"@type": "Answer", "text": "IfcMapConversion and IfcProjectedCRS were introduced in IFC4. IFC2x3 files cannot carry them. Georeferencing in IFC2x3 relies on IfcSite RefLatitude, RefLongitude, and RefElevation, which are coarse degrees-minutes-seconds tuples intended as an approximate anchor, not a precise grid transform."}
        },
        {
          "@type": "Question",
          "name": "How is the grid rotation encoded in IfcMapConversion?",
          "acceptedAnswer": {"@type": "Answer", "text": "The rotation is stored as a unit direction vector in XAxisAbscissa (its cosine) and XAxisOrdinate (its sine), not as an angle. Recover the counter-clockwise angle from grid east with atan2(XAxisOrdinate, XAxisAbscissa). If both are absent, assume no rotation."}
        },
        {
          "@type": "Question",
          "name": "What does the Scale attribute on IfcMapConversion do?",
          "acceptedAnswer": {"@type": "Answer", "text": "Scale is a combined map scale factor that relates model distances to grid distances, absorbing the point scale factor of the projection. It defaults to 1.0 when omitted. Apply it to the rotated local coordinates before adding the eastings and northings offset."}
        },
        {
          "@type": "Question",
          "name": "How do I convert IfcSite RefLatitude to decimal degrees?",
          "acceptedAnswer": {"@type": "Answer", "text": "RefLatitude and RefLongitude are lists of integers: degrees, minutes, seconds, and optionally millionths of a second. Convert with degrees + minutes/60 + seconds/3600 + millionths/(3600 x 1e6), carrying the sign of the first non-zero component across all terms."}
        }
      ]
    }
  ]
}
</script>

# Reading IFC Georeferencing with ifcopenshell

The direct answer: an IFC4 file records its georeferencing in an `IfcMapConversion` object, which carries the `Eastings`, `Northings`, `OrthogonalHeight`, `XAxisAbscissa`, `XAxisOrdinate`, and `Scale` needed to map local model coordinates onto a projected grid, and links to an `IfcProjectedCRS` naming the grid (for example `EPSG:25832`). Read those attributes with `ifcopenshell`, derive the rotation as `atan2(XAxisOrdinate, XAxisAbscissa)`, and apply rotation, scale, and offset to move local `(x, y, z)` to projected `(E, N, H)`. IFC2x3 has no map conversion, so fall back to the `IfcSite` latitude/longitude anchor. This closes the coordinate gap left open by the geometry routines in the [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) guide.

---

## How ifcopenshell Exposes Georeferencing

IFC4 introduced a formal coordinate-operation model. The model's `IfcGeometricRepresentationContext` (the same context that defines precision and dimensionality) can reference an `IfcMapConversion` through its inverse `HasCoordinateOperation` attribute. That map conversion is the bridge between the file's local engineering coordinates and a real-world projected system. Its `TargetCRS` is an `IfcProjectedCRS` whose `Name` is conventionally an EPSG string such as `EPSG:25832`, alongside optional `GeodeticDatum`, `MapProjection`, `MapZone`, and `MapUnit` fields.

The map conversion stores a rigid 2D transform plus a height offset:

<!-- fig:georef-map-conversion -->
<svg viewBox="-20 -20 446.6 194.1" role="img" aria-label="Eastings, northings, height, the X-axis abscissa pair and scale — the fields of an IfcMapConversion" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:447px;display:block;margin:1.5rem auto;">
  <title>The parameters a map conversion carries</title>
  <desc>The fields of the coordinate operation that relates the model's local engineering frame to a projected coordinate reference system. Eastings and northings place the model origin, the height offsets it vertically, the two abscissa components encode the rotation as a direction vector rather than an angle, and the scale reconciles the model unit with the projection unit.</desc>
  <defs>
    <marker id="geo1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="geo1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="446.6" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="207.4" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Eastings         432187.55</text>
  <line x1="213.4" y1="12.9" x2="245.4" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">where the model origin sits</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Northings        512044.10</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">OrthogonalHeight     42.30</text>
  <line x1="213.4" y1="50.9" x2="245.4" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">vertical offset</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">XAxisAbscissa     0.99966</text>
  <line x1="213.4" y1="69.9" x2="245.4" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">rotation as a direction, not an angle</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">XAxisOrdinate     0.02618</text>
  <text x="14" y="111" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Scale                1.000</text>
  <line x1="213.4" y1="107.9" x2="245.4" y2="107.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="111" font-size="9.5" fill="currentColor" fill-opacity="0.78">model unit against projection unit</text>
  <text x="0" y="152" font-size="9.5" fill="currentColor" fill-opacity="0.7">The rotation is a vector pair — take its arctangent, do not read it as degrees.</text>
</svg>
<!-- /fig:georef-map-conversion -->

- **`Eastings`, `Northings`, `OrthogonalHeight`** — the projected coordinates of the model's local origin.
- **`XAxisAbscissa`, `XAxisOrdinate`** — the components of a unit vector giving the direction of the local X axis in the grid. They encode rotation as `(cos θ, sin θ)`, not as an angle.
- **`Scale`** — a combined map scale factor relating model distances to grid distances. It defaults to `1.0`.

The forward transform for a local point `(x, y)` follows the buildingSMART definition:

```
E = Eastings  + Scale * (x * XAxisAbscissa - y * XAxisOrdinate)
N = Northings + Scale * (x * XAxisOrdinate + y * XAxisAbscissa)
H = OrthogonalHeight + z * Scale
```

The rotation angle, when you need it explicitly (for aligning a north arrow or reprojecting downstream), is `θ = atan2(XAxisOrdinate, XAxisAbscissa)`.

`ifcopenshell` ships a helper module, `ifcopenshell.util.geolocation`, whose functions `xyz2enh` and `enh2xyz` apply exactly this forward and inverse transform, while `local2global` composes it into a placement matrix. Those helpers are convenient, but reading the attributes yourself keeps the transform explicit and portable — the approach the script below takes.

What IFC georeferencing does **not** guarantee:

- **It is not always present.** IFC2x3 predates `IfcMapConversion` entirely, and many IFC4 exports still omit it.
- **The CRS `Name` is not validated.** It is a free-text label; `EPSG:25832`, `25832`, and `ETRS89 / UTM zone 32N` all appear in the wild.
- **The `IfcSite` fallback is coarse.** `RefLatitude`/`RefLongitude` are degrees-minutes-seconds tuples meant as an approximate anchor, not a survey-grade grid transform.

<svg viewBox="0 0 720 260" role="img" aria-label="Decision path for IFC georeferencing: use IfcMapConversion when present, otherwise fall back to IfcSite latitude and longitude" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>IFC georeferencing resolution and fallback</title>
  <desc>The representation context links to IfcMapConversion and IfcProjectedCRS for a precise grid transform; when that is absent, as in IFC2x3, the path falls back to IfcSite RefLatitude, RefLongitude, and RefElevation converted from degrees-minutes-seconds.</desc>
  <defs>
    <marker id="geo-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="260" fill="var(--color-surface)"/>
  <rect x="270" y="8" width="180" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="360" y="28" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">RepresentationContext</text>
  <text x="360" y="45" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">HasCoordinateOperation?</text>
  <line x1="290" y1="56" x2="180" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#geo-arrow)"/>
  <text x="205" y="78" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">present</text>
  <line x1="430" y1="56" x2="545" y2="92" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.5" marker-end="url(#geo-arrow)"/>
  <text x="520" y="78" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">absent (IFC2x3)</text>
  <rect x="70" y="94" width="196" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="168" y="116" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcMapConversion</text>
  <text x="168" y="133" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">E, N, H, rotation, scale</text>
  <rect x="452" y="94" width="196" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.45"/>
  <text x="550" y="116" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor" opacity="0.85">IfcSite lat / long</text>
  <text x="550" y="133" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">DMS tuples, coarse</text>
  <line x1="168" y1="146" x2="168" y2="182" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#geo-arrow)"/>
  <line x1="550" y1="146" x2="550" y2="182" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.5" marker-end="url(#geo-arrow)"/>
  <rect x="70" y="184" width="196" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="168" y="206" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Projected E / N</text>
  <text x="168" y="223" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">IfcProjectedCRS grid</text>
  <rect x="452" y="184" width="196" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.45"/>
  <text x="550" y="206" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor" opacity="0.85">Decimal degrees</text>
  <text x="550" y="223" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">EPSG:4326 anchor</text>
  <text x="360" y="252" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">precise grid transform on the left; approximate site anchor fallback on the right</text>
</svg>

## Production-Ready Script

The script reads the `IfcProjectedCRS` name and `IfcMapConversion` parameters, builds a forward transform, and maps a batch of local coordinates to projected eastings and northings. When no map conversion exists it falls back to the `IfcSite` degrees-minutes-seconds anchor. The math is written out explicitly so the transform is auditable and does not depend on a specific `util.geolocation` signature.

```python
# ifcopenshell>=0.8.0, numpy>=1.24.0, Python 3.9+
import ifcopenshell
import numpy as np
import math
from dataclasses import dataclass
from typing import Optional


@dataclass
class MapTransform:
    eastings: float
    northings: float
    orthogonal_height: float
    x_abscissa: float   # cos(rotation)
    x_ordinate: float   # sin(rotation)
    scale: float
    crs_name: Optional[str]

    @property
    def rotation_rad(self) -> float:
        return math.atan2(self.x_ordinate, self.x_abscissa)

    def apply(self, xyz: np.ndarray) -> np.ndarray:
        """Map local (N,3) coordinates to projected (E, N, H)."""
        x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
        e = self.eastings + self.scale * (x * self.x_abscissa - y * self.x_ordinate)
        n = self.northings + self.scale * (x * self.x_ordinate + y * self.x_abscissa)
        h = self.orthogonal_height + z * self.scale
        return np.column_stack([e, n, h])


def read_map_transform(model) -> Optional[MapTransform]:
    """Read IfcMapConversion + IfcProjectedCRS. Returns None if absent (IFC2x3)."""
    conversions = model.by_type("IfcMapConversion")
    if not conversions:
        return None
    mc = conversions[0]

    # TargetCRS is the IfcProjectedCRS; its Name is usually an EPSG string.
    crs_name = None
    target = getattr(mc, "TargetCRS", None)
    if target is not None:
        crs_name = getattr(target, "Name", None)

    # XAxisAbscissa/XAxisOrdinate are optional; default to no rotation.
    abscissa = mc.XAxisAbscissa if mc.XAxisAbscissa is not None else 1.0
    ordinate = mc.XAxisOrdinate if mc.XAxisOrdinate is not None else 0.0
    # Normalize the direction vector so it is a true unit rotation.
    mag = math.hypot(abscissa, ordinate) or 1.0

    return MapTransform(
        eastings=mc.Eastings or 0.0,
        northings=mc.Northings or 0.0,
        orthogonal_height=mc.OrthogonalHeight or 0.0,
        x_abscissa=abscissa / mag,
        x_ordinate=ordinate / mag,
        scale=mc.Scale if mc.Scale is not None else 1.0,
        crs_name=crs_name,
    )


def _dms_to_dd(dms) -> float:
    """Convert an IFC compound-plane-angle [deg, min, sec, millionths] to decimal."""
    d = dms[0]
    m = dms[1] if len(dms) > 1 else 0
    s = dms[2] if len(dms) > 2 else 0
    us = dms[3] if len(dms) > 3 else 0  # millionths of a second
    sign = -1.0 if min(d, m, s, us) < 0 else 1.0
    return sign * (abs(d) + abs(m) / 60.0 + abs(s) / 3600.0 + abs(us) / (3600.0 * 1e6))


def read_site_anchor(model) -> Optional[dict]:
    """IFC2x3 fallback: coarse geographic anchor from IfcSite."""
    sites = model.by_type("IfcSite")
    if not sites:
        return None
    site = sites[0]
    if not site.RefLatitude or not site.RefLongitude:
        return None
    return {
        "latitude": _dms_to_dd(site.RefLatitude),
        "longitude": _dms_to_dd(site.RefLongitude),
        "elevation": site.RefElevation or 0.0,
    }


if __name__ == "__main__":
    model = ifcopenshell.open("model.ifc")

    transform = read_map_transform(model)
    if transform is not None:
        print(f"Projected CRS: {transform.crs_name}")
        print(f"Grid rotation: {math.degrees(transform.rotation_rad):.4f} deg")
        # Example: move three local points onto the projected grid.
        local = np.array([[0.0, 0.0, 0.0],
                          [10.0, 0.0, 3.0],
                          [10.0, 5.0, 3.0]])
        print(transform.apply(local))
    else:
        anchor = read_site_anchor(model)
        if anchor:
            print(f"No IfcMapConversion; IfcSite anchor: "
                  f"{anchor['latitude']:.6f}, {anchor['longitude']:.6f}")
        else:
            print("No georeferencing found in this file.")
```

Key implementation notes:

- The direction vector is normalized (`abscissa / mag`, `ordinate / mag`) before use. Some exporters store a slightly non-unit vector; normalizing prevents a stray scale creeping into the rotation.
- Every attribute read is null-guarded. `XAxisAbscissa`, `XAxisOrdinate`, and `Scale` are optional in the schema, and a missing rotation must default to the identity, not to zero.
- `_dms_to_dd` carries a single sign across all components. IFC stores negative latitudes and longitudes with every non-zero element negated, so taking the sign from the minimum component is robust when the degrees field itself is zero.
- The transform is a rigid 2D map conversion plus a height offset. It does not reproject between two EPSG grids — for that, feed the projected `crs_name` and the eastings/northings into a `pyproj` transformer, as shown in [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/).

The projected coordinates from `transform.apply` are exactly what the footprints in [Batch Converting IFC to GeoJSON with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/) need before serialization.

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|-----------------|-------|
| Python | 3.9 – 3.12 | `dataclasses` and `math.atan2` only; no external transform dependency |
| ifcopenshell | ≥ 0.8.0 | `by_type` attribute access is schema-stable; `util.geolocation` helpers (`xyz2enh`, `enh2xyz`, `local2global`) available since 0.7.0 |
| NumPy | ≥ 1.24.0 | Vectorizes the transform over coordinate batches |
| IFC4 / IFC4x3 | Full | `IfcMapConversion` + `IfcProjectedCRS`; IFC4x3 adds optional `ScaleY`/`ScaleZ` for anisotropic scaling |
| IFC2x3 | Fallback only | No map conversion; use `IfcSite` `RefLatitude`/`RefLongitude`/`RefElevation` |
| CRS resolution | pyproj ≥ 3.5 | Needed only to interpret the `IfcProjectedCRS` name or reproject onward |

## Fallback Strategies

**1. No `IfcMapConversion` (IFC2x3 or an unreferenced IFC4 export)**

<!-- fig:georef-fallback-order -->
<svg viewBox="-20 -20 480.2 216.2" role="img" aria-label="Use IfcMapConversion when present, fall back to IfcSite reference coordinates for placement only, otherwise fit from control points" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:480px;display:block;margin:1.5rem auto;">
  <title>What to do when a model carries no map conversion</title>
  <desc>A branch on what georeferencing the file actually declares. A map conversion with a projected CRS is authoritative. A site with reference latitude and longitude is a weaker signal — degrees-minutes-seconds arrays, usually rounded, good for placing a model on a map but not for setting anything out. A model with neither must be georeferenced from surveyed control points, which is a different job.</desc>
  <defs>
    <marker id="geo2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="geo2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="480.2" height="216.2" fill="var(--color-surface)"/>
  <polygon points="220.1,0 335.5,31 220.1,62 104.7,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="220.1" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What georeferencing is declared?</text>
  <rect x="0" y="128" width="128.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="64" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Authoritative</text>
  <text x="64" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">projected CRS named</text>
  <path d="M 220.1 62 L 220.1 92 L 64 92 L 64 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#geo2-a)" stroke-linejoin="round"/>
  <text x="64" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">IfcMapConversion</text>
  <rect x="156.1" y="128" width="128.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="220.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Placement only</text>
  <text x="220.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">rounded DMS arrays</text>
  <path d="M 220.1 62 L 220.1 92 L 220.1 92 L 220.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#geo2-a)" stroke-linejoin="round"/>
  <text x="220.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">IfcSite lat/long only</text>
  <rect x="312.1" y="128" width="128.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="376.2" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fit from control</text>
  <text x="376.2" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a survey problem</text>
  <path d="M 220.1 62 L 220.1 92 L 376.2 92 L 376.2 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#geo2-a)" stroke-linejoin="round"/>
  <text x="376.2" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">neither</text>
</svg>
<!-- /fig:georef-fallback-order -->

`read_map_transform` returns `None`. Drop to `read_site_anchor`, but treat the result as an approximate origin only. Combine it with a known project rotation from survey documentation rather than trusting the file to supply the grid alignment.

**2. Keep working in local coordinates when georeferencing is missing**

For internal geometry checks you often do not need real-world coordinates at all. Expose a `local_fallback` flag so the pipeline continues with an identity transform and flags the output as ungeoreferenced:

```python
# ifcopenshell>=0.8.0
def resolve_transform(model, local_fallback=True):
    t = read_map_transform(model)
    if t is None and local_fallback:
        return MapTransform(0, 0, 0, 1.0, 0.0, 1.0, crs_name=None)  # identity
    return t
```

**3. Scale factor confusion**

`Scale` is a combined map scale factor, not a unit conversion. A millimeter model still needs its length-unit scaling applied separately via `ifcopenshell.util.unit.calculate_unit_scale`; do not fold the two together. Apply the unit scale to local coordinates first, then the map conversion.

**4. Rotation appears mirrored or 90 degrees off**

A mirrored result usually means the abscissa/ordinate pair was read as `(sin, cos)` instead of `(cos, sin)`. Confirm with `atan2(XAxisOrdinate, XAxisAbscissa)` — abscissa is the cosine term. A 90-degree error typically means a rotation was assumed when the vector was actually absent and should have defaulted to identity.

**5. `IfcProjectedCRS.Name` is not a clean EPSG code**

Normalize before handing it to `pyproj`. Strip whitespace, accept a bare integer as an EPSG code, and keep a small lookup for named grids your projects use:

```python
def normalize_crs(name: str) -> str:
    name = (name or "").strip()
    if name.isdigit():
        return f"EPSG:{name}"
    return name  # e.g. 'EPSG:25832' or a WKT string pyproj can parse
```

## FAQ

<details>
<summary><strong>Why does my IFC2x3 file have no IfcMapConversion?</strong></summary>

`IfcMapConversion` and `IfcProjectedCRS` were introduced in IFC4. IFC2x3 files cannot carry them. Georeferencing in IFC2x3 relies on `IfcSite` `RefLatitude`, `RefLongitude`, and `RefElevation`, which are coarse degrees-minutes-seconds tuples intended as an approximate anchor, not a precise grid transform.

</details>

<details>
<summary><strong>How is the grid rotation encoded in IfcMapConversion?</strong></summary>

The rotation is stored as a unit direction vector in `XAxisAbscissa` (its cosine) and `XAxisOrdinate` (its sine), not as an angle. Recover the counter-clockwise angle from grid east with `atan2(XAxisOrdinate, XAxisAbscissa)`. If both are absent, assume no rotation.

</details>

<details>
<summary><strong>What does the Scale attribute on IfcMapConversion do?</strong></summary>

`Scale` is a combined map scale factor that relates model distances to grid distances, absorbing the point scale factor of the projection. It defaults to `1.0` when omitted. Apply it to the rotated local coordinates before adding the eastings and northings offset.

</details>

<details>
<summary><strong>How do I convert IfcSite RefLatitude to decimal degrees?</strong></summary>

`RefLatitude` and `RefLongitude` are lists of integers: degrees, minutes, seconds, and optionally millionths of a second. Convert with `degrees + minutes/60 + seconds/3600 + millionths/(3600 x 1e6)`, carrying the sign of the first non-zero component across all terms.

</details>

---

## Related Pages

- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — parent guide covering geometry compilation and the coordinate stages this georeferencing feeds
- [Batch Converting IFC to GeoJSON with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/) — apply this map transform to footprints before writing GeoJSON
- [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) — sibling routine that produces the local geometry this transform georeferences
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — reproject the projected eastings and northings between EPSG grids
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — the wider local-to-global coordinate normalization workflow
