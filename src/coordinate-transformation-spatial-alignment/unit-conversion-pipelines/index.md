---
title: "Unit Conversion Pipelines for CAD, GIS & BIM Interoperability"
description: "Build deterministic unit conversion pipelines in Python that normalize CAD drawing units, GIS projection units, and IFC metric standards into a canonical measurement space without silent data corruption."
slug: "unit-conversion-pipelines"
type: "cluster"
breadcrumb:
  - label: "Home"
    url: "/"
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Unit Conversion Pipelines"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"
datePublished: "2024-03-15"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Unit Conversion Pipelines for CAD, GIS & BIM Interoperability",
      "description": "Build deterministic unit conversion pipelines in Python that normalize CAD drawing units, GIS projection units, and IFC metric standards into a canonical measurement space without silent data corruption.",
      "datePublished": "2024-03-15",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "publisher": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://cad-gis-bim-interop.org/"},
        {"@type": "ListItem", "position": 2, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 3, "name": "Unit Conversion Pipelines", "item": "https://cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Build a Unit Conversion Pipeline for CAD/GIS/BIM Data",
      "description": "Step-by-step guide to building a production-grade Python unit conversion pipeline that normalizes CAD, GIS, and BIM spatial data into a canonical metric workspace.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Metadata Extraction & Unit Declaration", "text": "Parse file headers, entity properties, and embedded schemas to identify declared units. Handle DXF $INSUNITS, IFC IfcUnitAssignment, and GeoJSON CRS metadata."},
        {"@type": "HowToStep", "position": 2, "name": "Canonical Normalization", "text": "Convert all geometries and measurements to a single internal canonical unit using dimensionally aware arithmetic with pint."},
        {"@type": "HowToStep", "position": 3, "name": "Coordinate & Attribute Transformation", "text": "Scale vertex arrays, line weights, text heights, and block insertion points using vectorized numpy operations."},
        {"@type": "HowToStep", "position": 4, "name": "Validation & Tolerance Enforcement", "text": "Validate geometric integrity using epsilon-based comparisons; route failures to a quarantine queue."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What does $INSUNITS=0 mean in a DXF file?",
          "acceptedAnswer": {"@type": "Answer", "text": "$INSUNITS=0 means the drawing is unitless — no unit is declared in the file header. You must infer the intended unit from coordinate magnitude heuristics or external project metadata before applying any conversion factor."}
        },
        {
          "@type": "Question",
          "name": "Can I apply a linear scale factor directly to geographic coordinates?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Geographic coordinates (latitude/longitude in degrees) are not linearly related to metric distances. You must first project the data into a local Cartesian CRS using pyproj, apply the linear scale, then reproject if needed."}
        },
        {
          "@type": "Question",
          "name": "How does pint prevent unit mismatch in chained conversions?",
          "acceptedAnswer": {"@type": "Answer", "text": "pint tracks dimensional type (length, area, volume) through the unit registry. An attempt to convert meters to square meters raises a DimensionalityError at runtime rather than silently returning a wrong number, making chained conversion bugs visible immediately."}
        },
        {
          "@type": "Question",
          "name": "How should mixed-unit BIM federations be normalized?",
          "acceptedAnswer": {"@type": "Answer", "text": "Normalize each component file independently before assembly. After each file is in the canonical unit, run a global bounding-box and interface-alignment check. Mismatched connection points should trigger automated clash alerts, not silent re-scaling."}
        }
      ]
    }
  ]
}
</script>

# Unit Conversion Pipelines for CAD, GIS & BIM Interoperability

Unit conversion pipelines deterministically normalize heterogeneous measurement systems — CAD drawing units, GIS projection units, and IFC metric standards — into a single canonical workspace, eliminating the silent scale corruption that invalidates downstream spatial queries and model federation.

As a foundational stage of the [Coordinate Transformation & Spatial Alignment](/coordinate-transformation-spatial-alignment/) pipeline, unit normalization must run before any reprojection or geometric synchronization step. Applying a CRS transformation to millimeter-scaled coordinates that were never converted to meters produces results that appear valid but are off by a factor of 1,000 — a failure mode that propagates silently until it surfaces as misaligned assets in a federated model review.

---

<!-- Inline SVG: Unit Conversion Pipeline Architecture -->
<svg viewBox="0 0 780 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unit Conversion Pipeline showing four sequential stages: Metadata Extraction, Canonical Normalization, Coordinate and Attribute Transformation, and Validation and Export" style="width:100%;max-width:780px;display:block;margin:2rem auto;">
  <title>Unit Conversion Pipeline Architecture</title>
  <desc>Four sequential pipeline stages connected by arrows: Metadata Extraction reads DXF $INSUNITS, IFC IfcUnitAssignment, and GeoJSON CRS; Canonical Normalization converts to meters using pint; Coordinate and Attribute Transformation applies numpy vectorized scaling; Validation and Export enforces tolerance thresholds and writes unit-declared outputs.</desc>
  <defs>
    <marker id="ucp-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <!-- Stage boxes -->
  <rect x="10" y="60" width="160" height="100" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="210" y="60" width="160" height="100" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="410" y="60" width="160" height="100" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="610" y="60" width="160" height="100" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <!-- Arrows -->
  <line x1="170" y1="110" x2="208" y2="110" stroke="currentColor" stroke-width="1.5" opacity="0.6" marker-end="url(#ucp-arrow)"/>
  <line x1="370" y1="110" x2="408" y2="110" stroke="currentColor" stroke-width="1.5" opacity="0.6" marker-end="url(#ucp-arrow)"/>
  <line x1="570" y1="110" x2="608" y2="110" stroke="currentColor" stroke-width="1.5" opacity="0.6" marker-end="url(#ucp-arrow)"/>
  <!-- Stage labels -->
  <text x="90" y="90" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Metadata</text>
  <text x="90" y="106" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Extraction</text>
  <text x="90" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">$INSUNITS</text>
  <text x="90" y="141" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">IfcUnitAssignment</text>
  <text x="290" y="90" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Canonical</text>
  <text x="290" y="106" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Normalization</text>
  <text x="290" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">pint algebra</text>
  <text x="290" y="141" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">→ meters</text>
  <text x="490" y="90" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Coordinate &amp;</text>
  <text x="490" y="106" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Attr Transform</text>
  <text x="490" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">numpy vectorized</text>
  <text x="490" y="141" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">recursive blocks</text>
  <text x="690" y="90" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Validation &amp;</text>
  <text x="690" y="106" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Export</text>
  <text x="690" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">epsilon checks</text>
  <text x="690" y="141" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">unit declarations</text>
  <!-- Stage numbers -->
  <circle cx="30" cy="72" r="9" fill="currentColor" opacity="0.15"/>
  <text x="30" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">1</text>
  <circle cx="230" cy="72" r="9" fill="currentColor" opacity="0.15"/>
  <text x="230" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">2</text>
  <circle cx="430" cy="72" r="9" fill="currentColor" opacity="0.15"/>
  <text x="430" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">3</text>
  <circle cx="630" cy="72" r="9" fill="currentColor" opacity="0.15"/>
  <text x="630" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">4</text>
</svg>

---

## Prerequisites

Before implementing a conversion pipeline, establish a controlled environment that prevents silent data corruption during ingestion. Spatial unit conversion is not merely scalar multiplication; it requires explicit handling of implicit drawing units, coordinate reference system (CRS) scaling factors, and floating-point accumulation.

- **Python 3.9+** with strict typing enabled and `mypy` configured for CI validation
- **Core libraries** (install with pip):
  ```
  pip install pint>=0.23 pyproj>=3.6 numpy>=1.26 shapely>=2.0
  ```
- **Domain parsers**:
  ```
  pip install ezdxf>=1.2 ifcopenshell geopandas>=0.14 fiona>=1.9
  ```
- **Configuration schema**: YAML or JSON mapping files defining source-to-target unit matrices, fallback behaviors, and precision thresholds per asset class
- **Structured logging**: `structlog>=23` or `loguru>=0.7` to track conversion drift, skipped entities, tolerance violations, and pipeline latency
- **Assumed knowledge**: familiarity with DXF `$INSUNITS` group codes, `IfcUnitAssignment` traversal, and the distinction between geographic (degree-based) and projected (metric) coordinate systems

---

## Architectural Overview

### How Unit Declarations Differ Across Formats

Each format carries unit metadata in a different location and with different guarantees:

| Format | Unit Declaration Location | Default When Absent | Reliability |
|---|---|---|---|
| DXF/DWG | `$INSUNITS` header variable (0–20) | `0` = Unitless | Low — many exporters omit it |
| IFC 2x3/4 | `IfcUnitAssignment` at project level | None (invalid schema) | High — required by spec |
| GeoJSON | CRS in `"crs"` member (RFC 7946 drops it) | WGS84 degrees | Medium — RFC 7946 forbids custom CRS |
| Shapefile | `.prj` sidecar WKT string | No sidecar → unknown | Medium — sidecar often missing |
| GeoPackage | `gpkg_spatial_ref_sys` table | EPSG:4326 assumed | High — embedded in container |
| GML/CityGML | `srsName` attribute on geometry elements | None | Medium — attribute optional |

The `$INSUNITS` integer in DXF maps as follows: `0`=Unitless, `1`=Inches, `2`=Feet, `4`=Millimeters, `6`=Meters, `7`=Kilometers. Any value of `0` requires heuristic resolution before conversion can proceed.

### Internal Canonical Unit

The pipeline normalizes all input to **meters** as the internal canonical unit. Meters are the linear unit of the SI system, the implicit unit of most GIS projections, and the base unit of `IfcUnitAssignment` in IFC 4.x. Downstream consumers — reprojection via `pyproj`, topology validation via `shapely`, and [CRS Normalization Workflows](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — all expect metric input.

Converting to a canonical unit once, at the ingestion boundary, is cheaper and safer than tracking per-dataset units through every downstream transformation stage. It also isolates the unit-awareness concern so that [Scale and Rotation Synchronization](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) can operate on geometry that is already metrically consistent.

---

## Step-by-Step Implementation

### Step 1 — Metadata Extraction & Unit Declaration

Parse file headers, entity properties, and embedded schemas to identify declared units. When metadata is absent or corrupted, apply heuristic detection based on coordinate magnitude and domain rules. Log all heuristic decisions at `WARNING` severity — never assume silently.

```python
# pint>=0.23, ezdxf>=1.2, ifcopenshell
from __future__ import annotations
from typing import Optional
import logging
import ezdxf
import ifcopenshell

log = logging.getLogger(__name__)

# DXF $INSUNITS → unit string mapping
INSUNITS_MAP: dict[int, str] = {
    1: "inch", 2: "foot", 4: "millimeter",
    5: "centimeter", 6: "meter", 7: "kilometer",
}

def extract_dxf_unit(path: str) -> str:
    doc = ezdxf.readfile(path)
    insunits: int = doc.header.get("$INSUNITS", 0)
    if insunits == 0 or insunits not in INSUNITS_MAP:
        # Heuristic: sample bounding box of modelspace
        unit = _heuristic_dxf_unit(doc)
        log.warning("$INSUNITS absent/unitless in %s; inferred %s", path, unit)
        return unit
    return INSUNITS_MAP[insunits]

def _heuristic_dxf_unit(doc: ezdxf.document.Drawing) -> str:
    """Infer unit from coordinate magnitude of modelspace entities."""
    msp = doc.modelspace()
    extents = [e.dxf.insert for e in msp if hasattr(e.dxf, "insert")]
    if not extents:
        return "millimeter"  # safe default for architectural CAD
    max_coord = max(abs(p.x) + abs(p.y) for p in extents)
    if max_coord > 50_000:
        return "millimeter"
    if max_coord > 500:
        return "meter"
    return "foot"

def extract_ifc_unit(path: str) -> str:
    model = ifcopenshell.open(path)
    project = model.by_type("IfcProject")[0]
    for unit_assignment in project.UnitsInContext.Units:
        if getattr(unit_assignment, "UnitType", None) == "LENGTHUNIT":
            prefix = getattr(unit_assignment, "Prefix", None) or ""
            name = getattr(unit_assignment, "Name", "METRE")
            return f"{prefix.lower()}{name.lower()}".replace("metre", "meter")
    log.warning("No length unit found in IfcUnitAssignment; defaulting to meter")
    return "meter"
```

### Step 2 — Canonical Normalization with `pint`

Build a reusable `UnitConverter` that computes the scale factor once using `pint`'s dimensional algebra rather than hardcoded multiplication constants. This prevents mismatch when the same converter handles derived quantities (area in m², volume in m³) that scale by the square or cube of the linear factor.

```python
# pint>=0.23, numpy>=1.26
from __future__ import annotations
import numpy as np
import pint
from dataclasses import dataclass

ureg = pint.UnitRegistry()
Q_ = ureg.Quantity

@dataclass(frozen=True)
class ConversionConfig:
    source_unit: str        # e.g. "millimeter", "foot"
    target_unit: str = "meter"
    tolerance_m: float = 1e-6     # geometric epsilon in target unit
    max_scale_factor: float = 1e4  # sanity guard

class UnitConverter:
    def __init__(self, config: ConversionConfig) -> None:
        self.config = config
        self.scale_factor: float = (
            Q_(1, config.source_unit).to(config.target_unit).magnitude
        )
        self._validate()

    def _validate(self) -> None:
        if not (0 < self.scale_factor <= self.config.max_scale_factor):
            raise ValueError(
                f"Scale factor {self.scale_factor:.6g} out of safe range "
                f"({self.config.source_unit} → {self.config.target_unit})"
            )

    def scale_coordinates(self, coords: np.ndarray) -> np.ndarray:
        """Vectorized Nx2 or Nx3 coordinate scaling. Input dtype: float64."""
        if coords.ndim != 2 or coords.shape[1] not in (2, 3):
            raise ValueError("coords must be Nx2 or Nx3 float64 array")
        return coords * self.scale_factor

    def scale_attribute(self, values: np.ndarray, attr_unit: str) -> np.ndarray:
        """Scale a non-geometric attribute with its own declared unit."""
        factor = Q_(1, attr_unit).to(self.config.target_unit).magnitude
        return values * factor
```

### Step 3 — Coordinate & Attribute Transformation

Apply the converter across all geometry types in the source dataset. Crucially, scale and rotation must remain decoupled: apply the unit scale factor to the translation component of any nested transformation matrix but do not mix it with the rotational sub-matrix. Mixing produces shear artifacts in block-inserted geometry.

```python
# numpy>=1.26, ezdxf>=1.2
import numpy as np
from typing import Iterator
import ezdxf
from ezdxf.entities import DXFGraphic

def iter_entity_coords(
    msp: ezdxf.layouts.Modelspace,
) -> Iterator[tuple[str, np.ndarray]]:
    """Yield (entity_handle, Nx3 coordinate array) for each geometry entity."""
    for entity in msp:
        handle = entity.dxf.handle
        if entity.dxftype() == "LINE":
            pts = np.array([
                [entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z],
                [entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z],
            ], dtype=np.float64)
            yield handle, pts
        elif entity.dxftype() == "LWPOLYLINE":
            pts = np.array(
                [[p[0], p[1], 0.0] for p in entity.get_points()],
                dtype=np.float64,
            )
            yield handle, pts
        # Extend for ARC, CIRCLE, INSERT (block references), SPLINE, etc.

def convert_modelspace(
    doc: ezdxf.document.Drawing,
    converter: UnitConverter,
) -> dict[str, np.ndarray]:
    """Return {handle: scaled_coords} for the entire modelspace."""
    msp = doc.modelspace()
    result: dict[str, np.ndarray] = {}
    for handle, coords in iter_entity_coords(msp):
        result[handle] = converter.scale_coordinates(coords)
    return result
```

For INSERT (block reference) entities, apply a recursive pass that scales the insertion point but leaves the block-internal rotation matrix untouched. Flatten nested transformations only after canonical normalization.

### Step 4 — Validation & Tolerance Enforcement

After scaling, validate geometric integrity using epsilon-based comparisons. Floating-point arithmetic introduces micro-drift that can break topological relationships, snap vertices incorrectly, or invalidate closed polylines.

```python
# shapely>=2.0, numpy>=1.26
from __future__ import annotations
import numpy as np
from shapely.geometry import Polygon
from dataclasses import dataclass

@dataclass
class ValidationResult:
    handle: str
    passed: bool
    message: str

def validate_polygon_closure(
    handle: str,
    coords: np.ndarray,
    epsilon: float = 1e-6,
) -> ValidationResult:
    """Check that a polygon's first and last vertex are within epsilon."""
    if coords.shape[0] < 3:
        return ValidationResult(handle, False, "Too few vertices for polygon")
    gap = np.linalg.norm(coords[0] - coords[-1])
    if gap > epsilon:
        return ValidationResult(
            handle, False,
            f"Open polygon: gap={gap:.3e} m (epsilon={epsilon:.3e} m)"
        )
    poly = Polygon(coords[:, :2])
    if not poly.is_valid:
        return ValidationResult(handle, False, f"Invalid topology: {poly.explain_validity()}")
    return ValidationResult(handle, True, "OK")

def validate_bounding_box(
    original_coords: np.ndarray,
    scaled_coords: np.ndarray,
    expected_scale: float,
    tolerance: float = 1e-4,
) -> bool:
    """Assert that the bounding-box diagonal scaled by expected_scale matches."""
    orig_diag = np.linalg.norm(original_coords.max(0) - original_coords.min(0))
    scaled_diag = np.linalg.norm(scaled_coords.max(0) - scaled_coords.min(0))
    if orig_diag == 0:
        return True
    ratio = scaled_diag / orig_diag
    return abs(ratio - expected_scale) < tolerance
```

---

## Edge Cases & Gotchas

### Missing `$INSUNITS` (DXF unitless drawings)

Many legacy DXF exporters write `$INSUNITS=0`. The coordinate values are numerically ambiguous without additional context. Resolution order: (1) check the block reference insertion scale in any enclosing drawing, (2) query the project metadata file or CAD standard document, (3) apply the statistical heuristic from Step 1 and log a `WARNING`. Never fail silently.

### Geographic Coordinates Mistaken for Projected Coordinates

Applying a linear scale factor to WGS84 latitude/longitude (EPSG:4326) values produces nonsense. Degrees are angular, not linear, and the meter-per-degree ratio varies with latitude. Fix: check whether the declared CRS is geographic before conversion. If geographic, reproject to a local projected CRS via `pyproj` first, apply unit normalization, then reproject back only if the output format requires it.

```python
# pyproj>=3.6
from pyproj import CRS, Transformer
import numpy as np

def guard_geographic_crs(epsg: int) -> bool:
    """Return True if the CRS is geographic (degree-based), not projected."""
    crs = CRS.from_epsg(epsg)
    return crs.is_geographic
```

### Mixed-Unit BIM Federations

BIM federations frequently combine models authored in different unit systems (architectural in millimeters, civil in meters). Do not attempt a single global scale pass. Normalize each component file independently, then merge. After merging, run an interface-alignment check: ductwork-to-structural connection points that diverge by more than 10 mm after normalization indicate a unit declaration error in one of the component files, not a pipeline bug.

### Floating-Point Accumulation in Repeated Scaling

Scaling a coordinate array twice — for example, millimeters to centimeters, then centimeters to meters — compounds IEEE 754 rounding errors versus a single millimeter-to-meter pass. Always compute a single composite scale factor from source to canonical unit using `pint`'s `to()` method, then apply it once.

### Attribute Units Diverging from Geometry Units

Structural member depth, pipe inner diameter, and insulation thickness are stored as scalar attributes alongside geometry. These attributes carry their own declared unit (often millimeters in BIM regardless of the geometry unit). Use `UnitConverter.scale_attribute()` with the attribute's declared unit, not the geometry scale factor, to avoid double-conversion errors.

### `IfcUnitAssignment` with Prefix Overrides

IFC models can declare `MILLI` as a prefix on the standard `METRE` length unit, yielding an effective millimeter workspace. The `Prefix` attribute is optional and defaults to no prefix when omitted — but some authoring tools omit it even when they are working in millimeters and rely on the coordinate magnitude to communicate scale. Always read `Prefix` explicitly and log its value before computing the scale factor.

---

## Validation & Testing

A correct unit conversion pipeline must pass a round-trip test: convert source units to canonical meters, then back to source units, and verify that the reconstructed values match the originals within the configured tolerance.

```python
# pytest>=7.0, numpy>=1.26, pint>=0.23
import numpy as np
import pytest
from your_pipeline import UnitConverter, ConversionConfig  # adjust import

def test_millimeter_to_meter_round_trip() -> None:
    cfg = ConversionConfig(source_unit="millimeter", target_unit="meter")
    conv = UnitConverter(cfg)
    original = np.array([[12500.0, 8000.0, 3000.0]], dtype=np.float64)

    scaled = conv.scale_coordinates(original)
    assert scaled.shape == original.shape
    np.testing.assert_allclose(scaled, [[12.5, 8.0, 3.0]], rtol=1e-9)

    # Reverse pass
    inv_cfg = ConversionConfig(source_unit="meter", target_unit="millimeter")
    inv_conv = UnitConverter(inv_cfg)
    reconstructed = inv_conv.scale_coordinates(scaled)
    np.testing.assert_allclose(reconstructed, original, rtol=1e-9)

def test_invalid_scale_factor_raises() -> None:
    cfg = ConversionConfig(
        source_unit="millimeter", target_unit="meter", max_scale_factor=1e-3
    )
    with pytest.raises(ValueError, match="out of safe range"):
        UnitConverter(cfg)

def test_heuristic_unit_detection_large_coords() -> None:
    """Coordinates > 50 000 should infer millimeters."""
    from your_pipeline import _heuristic_from_max_coord
    assert _heuristic_from_max_coord(75_000) == "millimeter"
    assert _heuristic_from_max_coord(800) == "meter"
```

Also validate that attribute scaling does not bleed into geometry scaling by asserting that the `scale_attribute()` path computes a different factor when attribute and geometry units differ:

```python
def test_attribute_unit_independence() -> None:
    cfg = ConversionConfig(source_unit="foot", target_unit="meter")
    conv = UnitConverter(cfg)
    # Geometry: feet → meters
    geo = np.array([[10.0, 0.0, 0.0]], dtype=np.float64)
    scaled_geo = conv.scale_coordinates(geo)
    np.testing.assert_allclose(scaled_geo[0, 0], 3.048, rtol=1e-6)
    # Attribute declared in millimeters, not feet
    attr = np.array([500.0])  # 500 mm pipe diameter
    scaled_attr = conv.scale_attribute(attr, attr_unit="millimeter")
    np.testing.assert_allclose(scaled_attr[0], 0.5, rtol=1e-6)
```

---

## Performance & Scale

### Vectorize Everything, Loop Nothing

Python-level loops over DXF entities are the dominant bottleneck in large drawings. Extract all vertex coordinates into a single `numpy.ndarray` before applying the scale factor, then scatter the scaled values back to entity records. This reduces the conversion of a 100,000-entity drawing from minutes to sub-second.

```python
# Batch extraction pattern (numpy>=1.26, ezdxf>=1.2)
all_coords = np.vstack([coords for _, coords in iter_entity_coords(msp)])
all_scaled = all_coords * converter.scale_factor
# Split back by entity length using np.split and saved index offsets
```

### Memory Budgets for Large IFC Files

IFC files for large infrastructure projects routinely exceed 500 MB. `ifcopenshell` loads the full model into memory by default. If the target environment has less than 4 GB available, process IFC geometry in discipline chunks (structural, MEP, architectural) using `ifcopenshell.util.selector` filters rather than loading all `IfcProduct` instances at once.

### Chunked Processing for GIS Vector Files

GIS layers with millions of features (road networks, cadastral parcels) should be read in spatial chunks using `geopandas.read_file()` with the `rows` slice parameter or `fiona`'s `window` argument. Apply the scale factor to each chunk's geometry column using `shapely.affinity.scale()` with a uniform factor — this is internally vectorized and avoids Python-level geometry iteration.

```python
# geopandas>=0.14, shapely>=2.0
import geopandas as gpd
from shapely.affinity import scale as shp_scale

CHUNK = 50_000

def convert_gdf_chunks(path: str, factor: float):
    for chunk in gpd.read_file(path, rows=slice(0, None, CHUNK)):
        chunk["geometry"] = chunk["geometry"].apply(
            lambda g: shp_scale(g, xfact=factor, yfact=factor, zfact=factor, origin=(0, 0, 0))
        )
        yield chunk
```

### Parallelization for Multi-File Pipelines

When normalizing a federation of dozens of IFC component files, use `concurrent.futures.ProcessPoolExecutor` with one worker per file. Each `UnitConverter` instance is stateless and safe to pickle, making it straightforward to distribute across processes without shared state.

---

## FAQ

<details>
<summary><strong>What does <code>$INSUNITS=0</code> mean in a DXF file?</strong></summary>

`$INSUNITS=0` means the drawing is unitless — no unit is declared in the file header. The coordinate values have no intrinsic scale. You must infer the intended unit from coordinate magnitude heuristics, enclosing block insertion scale, or external project metadata before applying any conversion factor. Log every heuristic decision at `WARNING` severity so the decision is auditable.

</details>

<details>
<summary><strong>Can I apply a linear scale factor directly to geographic coordinates?</strong></summary>

No. Geographic coordinates (latitude/longitude in degrees) are angular measurements. The meter-per-degree ratio varies with latitude and is nonlinear near the poles. You must first project the data into a local Cartesian CRS using `pyproj.Transformer`, apply the linear scale in that projected space, then reproject if the output format requires geographic coordinates. Applying a linear factor to degrees silently produces coordinates that appear plausible but are wrong by orders of magnitude.

</details>

<details>
<summary><strong>How does <code>pint</code> prevent unit mismatch in chained conversions?</strong></summary>

`pint` tracks dimensional type (length¹, length², length³) through its unit registry. An attempt to convert meters to square meters raises a `pint.errors.DimensionalityError` at runtime rather than silently returning a wrong number. This makes unit mismatch bugs visible immediately during development rather than during production validation. Use `Q_(value, unit).to(target_unit).magnitude` to extract a bare float only at the final output boundary; keep quantities as `Quantity` objects inside the pipeline.

</details>

<details>
<summary><strong>How should mixed-unit BIM federations be normalized?</strong></summary>

Normalize each component file independently before assembly — do not attempt a single global scale pass across a mixed federation. After each file is converted to the canonical meter workspace, assemble the federation and run a global bounding-box and interface-alignment check. Connection points between disciplines (ductwork to structural steel, for example) that diverge by more than 10 mm after normalization indicate a unit declaration error in one component file. Trigger an automated clash alert and quarantine the offending file for review rather than applying a corrective re-scale silently.

</details>

---

## Related Pages

- [Coordinate Transformation & Spatial Alignment](/coordinate-transformation-spatial-alignment/) — parent pipeline overview covering the full transformation stack
- [CRS Normalization Workflows](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — reprojection and datum shift patterns that run after unit normalization
- [Scale and Rotation Synchronization](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — similarity transformation for correcting geometric drift between datasets
- [Layer Mapping Logic](/coordinate-transformation-spatial-alignment/layer-mapping-logic/) — semantic classification routing that operates on metrically normalized geometry
- [Converting CAD Local Coordinates to EPSG:4326](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — end-to-end worked example combining unit normalization with CRS reprojection
