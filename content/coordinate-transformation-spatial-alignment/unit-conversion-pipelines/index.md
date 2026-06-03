# Unit Conversion Pipelines for CAD/GIS & BIM Interoperability

In AEC technology, spatial data rarely arrives in a consistent measurement system. CAD drawings default to drawing units (often inches, feet, or millimeters), GIS layers operate in projected meters or geographic degrees, and BIM models strictly adhere to IFC-compliant metric standards. Bridging these ecosystems requires deterministic **Unit Conversion Pipelines** that preserve geometric fidelity, maintain metadata integrity, and enforce tolerance thresholds before downstream processing.

As a foundational component of broader [Coordinate Transformation & Spatial Alignment](/coordinate-transformation-spatial-alignment/) strategies, these pipelines must operate statelessly, idempotently, and with explicit dimensional awareness. This guide details the architecture, implementation patterns, and validation strategies required to build production-grade unit normalization systems for infrastructure platform teams and Python automation builders.

## Prerequisites & Environmental Setup

Before implementing a conversion pipeline, establish a controlled execution environment that prevents silent data corruption during ingestion. Spatial unit conversion is not merely scalar multiplication; it requires explicit handling of implicit drawing units, coordinate reference system (CRS) scaling factors, and floating-point accumulation.

Ensure the following baseline requirements are met:

- **Python 3.9+** with strict typing enabled and `mypy` configured for CI validation
- **Core Libraries**: `pint` for dimensionally aware unit algebra, `pyproj` for spatial reference transformations, `numpy` for vectorized coordinate operations, and `shapely` for topology validation
- **Domain Parsers**: `ezdxf` for DWG/DXF ingestion, `ifcopenshell` for IFC schema traversal, `fiona`/`geopandas` for vector GIS formats
- **Configuration Schema**: YAML/JSON mapping files defining source-to-target unit matrices, fallback behaviors, and precision thresholds per asset class
- **Logging & Telemetry**: Structured logging (`structlog` or `loguru`) to track conversion drift, skipped entities, tolerance violations, and pipeline latency

Reference the official [Pint documentation](https://pint.readthedocs.io/en/stable/) for best practices on defining custom unit registries and preventing context leakage during chained operations.

## Pipeline Architecture & Step-by-Step Workflow

A robust unit conversion pipeline follows a deterministic, stateless transformation sequence. Each stage must be independently testable and capable of rolling back partial transformations without corrupting the source dataset.

### 1. Metadata Extraction & Unit Declaration
Parse file headers, entity properties, and embedded schemas to identify declared units. DXF files store drawing units in the `$INSUNITS` system variable (`0`=Unitless, `1`=Inches, `2`=Feet, `4`=Millimeters, `6`=Meters). IFC models define `IfcUnitAssignment` at the project level, and GeoJSON assumes meters or degrees per [RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946). When metadata is absent or corrupted, apply heuristic detection based on coordinate magnitude and domain rules (e.g., coordinates exceeding 10,000 typically indicate millimeters in architectural CAD, while values in the range 1–1,000 suggest meters or feet for site-scale work).

Implement a fallback registry that logs heuristic overrides with a `WARNING` severity level. Never assume default units silently; explicit declaration prevents downstream scale mismatches during asset federation.

### 2. Canonical Normalization
Convert all geometries and measurements to a single internal canonical unit, typically meters for AEC interoperability. Apply scaling factors using dimensionally aware arithmetic rather than raw multiplication. This prevents unit mismatch during chained operations and ensures that derived quantities (area, volume, mass) scale correctly according to dimensional exponents.

Once units are declared, the pipeline must resolve projection scaling before applying [CRS Normalization Workflows](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) to prevent compound distortion. Geographic coordinates (lat/lon) require ellipsoidal conversion before linear scaling, while projected coordinates can be scaled directly after verifying the linear unit factor in the CRS metadata.

### 3. Coordinate & Attribute Transformation
Scale vertex arrays, line weights, text heights, and block insertion points proportionally. Maintain attribute parity by applying conversion factors to non-geometric measurements (e.g., pipe diameters, structural member depths, thermal insulation thicknesses). Geometric scaling must remain decoupled from rotational matrices to avoid shear artifacts, a constraint thoroughly addressed in [Scale and Rotation Synchronization](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) protocols.

When transforming block references or nested components, apply a recursive scaling pass that respects parent-child transformation hierarchies. Flatten nested transformations only after canonical normalization to preserve local coordinate system integrity.

### 4. Validation & Tolerance Enforcement
After scaling, validate geometric integrity using epsilon-based comparisons. Floating-point arithmetic introduces micro-drift that can break topological relationships, snap vertices incorrectly, or invalidate closed polylines. Implement a tolerance manager that:
- Compares pre- and post-conversion bounding boxes against expected scale ratios
- Validates polygon closure within a configurable epsilon (e.g., `1e-6` meters for BIM, `1e-3` for GIS)
- Flags entities where scaled attributes exceed domain-specific thresholds (e.g., negative pipe diameters, text heights below readable limits)

Log all tolerance violations with entity IDs, original values, scaled values, and applied conversion factors. Route failed entities to a quarantine queue for manual review or automated heuristic correction.

## Implementation Patterns & Code Reliability

Production-grade pipelines require vectorized operations, strict type contracts, and explicit error boundaries. Below is a reference implementation demonstrating unit-aware coordinate scaling using `pint` and `numpy`.

```python
from __future__ import annotations
import numpy as np
import pint
from dataclasses import dataclass

ureg = pint.UnitRegistry()
Q_ = ureg.Quantity

@dataclass(frozen=True)
class ConversionConfig:
    source_unit: str
    target_unit: str
    tolerance_m: float = 1e-6
    max_scale_factor: float = 1e4

class UnitConverter:
    def __init__(self, config: ConversionConfig):
        self.config = config
        # Compute scale factor once using pint's dimensional algebra
        self.scale_factor: float = Q_(1, config.source_unit).to(config.target_unit).magnitude

    def validate_scale(self) -> None:
        if self.scale_factor <= 0 or self.scale_factor > self.config.max_scale_factor:
            raise ValueError(
                f"Invalid scale factor {self.scale_factor} for "
                f"{self.config.source_unit} -> {self.config.target_unit}"
            )

    def scale_coordinates(self, coords: np.ndarray) -> np.ndarray:
        """Vectorized coordinate scaling with dimension check."""
        self.validate_scale()
        if coords.ndim != 2 or coords.shape[1] not in (2, 3):
            raise ValueError("Coordinates must be Nx2 or Nx3 float64 array")
        return coords * self.scale_factor

    def scale_attributes(self, values: np.ndarray, unit: str) -> np.ndarray:
        """Scale non-geometric attributes with independent unit validation."""
        factor = Q_(1, unit).to(self.config.target_unit).magnitude
        return values * factor

# Example: convert millimeter CAD coordinates to meters
cfg = ConversionConfig(source_unit="millimeter", target_unit="meter")
converter = UnitConverter(cfg)

bim_coords_mm = np.array([[12500.0, 8000.0, 3000.0],
                           [12600.0, 8000.0, 3000.0]], dtype=np.float64)
bim_coords_m = converter.scale_coordinates(bim_coords_mm)
# Result: [[12.5, 8.0, 3.0], [12.6, 8.0, 3.0]]
```

Key reliability patterns embedded in this implementation:
- **Dimensional Safety**: `pint` prevents accidental mixing of linear, area, and volume units during scaling chains
- **Vectorized Operations**: `numpy` operations minimize Python overhead while enabling batch processing
- **Explicit Contracts**: `dataclass` configuration and type hints enforce pipeline consistency
- **Fail-Fast Validation**: Scale factor bounds halt execution before corrupted data propagates downstream

## Handling Edge Cases & Floating-Point Drift

Spatial datasets frequently contain mixed-unit files, legacy formats with undocumented scales, or coordinate systems with non-linear projection distortions. A resilient pipeline must account for these realities.

**Implicit Unit Detection**: When `$INSUNITS` or `IfcUnitAssignment` is missing, implement a statistical sampling routine that evaluates coordinate ranges against known domain distributions. Architectural models typically span 10–100 meters; civil infrastructure spans 100–10,000 meters; mechanical components span 0.1–5 meters. Cross-reference sampled ranges with asset type metadata to infer the most probable unit.

**Mixed-Unit Assemblies**: BIM federations often combine models created in different unit systems. Normalize each component independently before assembly, then apply a global tolerance check to verify interface alignment. Mismatched units at connection points (e.g., ductwork to structural steel) should trigger automated clash detection alerts rather than silent scaling.

**Floating-Point Accumulation**: Repeated scaling operations compound IEEE 754 rounding errors. Mitigate drift by:
1. Performing all arithmetic in double-precision (`numpy.float64`)
2. Rounding to a fixed decimal precision only at pipeline output boundaries
3. Storing original values alongside scaled values for audit reconciliation

**CRS-Dependent Scaling**: Linear units in projected coordinate systems (e.g., UTM, State Plane) are generally consistent, but geographic systems (lat/lon) require geodesic conversion. Never apply linear scaling factors directly to degree-based coordinates. Convert to a local projected CRS first, apply unit normalization, then reproject if necessary. This preserves angular relationships and prevents polar distortion.

## Integration with Downstream Systems

Once normalized, spatial data must be serialized into target formats without reintroducing unit ambiguity. Export pipelines should embed explicit unit declarations in file headers, strip heuristic metadata, and attach conversion audit logs as sidecar files or embedded XMP metadata.

For CAD outputs, write `$INSUNITS` to match the canonical target unit. For GIS exports, ensure the `.prj` or embedded CRS string reflects the linear unit of the projection. For IFC/BIM exports, verify that `IfcUnitAssignment` aligns with the normalized scale and that all property sets reference metric values consistently.

Automated testing should verify round-trip fidelity: normalize a dataset, export it, re-ingest it, and compare against the canonical baseline. Acceptable deviation should remain within the configured tolerance threshold across all geometry types and attribute classes.

## Conclusion

Unit Conversion Pipelines are the unsung foundation of spatial interoperability. By enforcing dimensional awareness, validating tolerance thresholds, and isolating scaling from rotational transformations, platform teams can eliminate silent data corruption and ensure reliable asset federation across CAD, GIS, and BIM ecosystems. Implement strict type contracts, vectorized validation, and explicit audit logging to transform unit normalization from a fragile preprocessing step into a deterministic, production-ready service.
