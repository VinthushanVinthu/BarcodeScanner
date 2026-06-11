import {
  BarChart2,
  Hash,
  Layers,
  MapPin,
  Package,
  Palette,
  Ruler,
  Scan,
  Tag,
} from "lucide-react";

export const FIELD_META = {
  sew: { label: "SEW", icon: Hash, color: "#818CF8" },
  cut: { label: "CUT", icon: Layers, color: "#F472B6" },
  so: { label: "Sales Order (SO)", icon: Tag, color: "#34D399" },
  li: { label: "Line Item (LI)", icon: Hash, color: "#FBBF24" },
  ref: { label: "Ref #", icon: Hash, color: "#A3E635" },
  vd: { label: "VD Code", icon: Package, color: "#60A5FA" },
  sg3: { label: "SG3 Number", icon: Hash, color: "#F87171" },
  color: { label: "Color / Style", icon: Palette, color: "#E879F9" },
  item: { label: "Item Details", icon: Package, color: "#38BDF8" },
  size: { label: "Size", icon: Ruler, color: "#4ADE80" },
  lineNum: { label: "Line Number", icon: BarChart2, color: "#FB923C" },
  bin: { label: "Bin / Code", icon: MapPin, color: "#A78BFA" },
  ocrBarcode: { label: "Barcode (OCR)", icon: Scan, color: "#94A3B8" },
};

export const RESULT_FIELD_ORDER = [
  "sew",
  "cut",
  "so",
  "li",
  "ref",
  "vd",
  "sg3",
  "color",
  "item",
  "size",
  "lineNum",
  "bin",
  "ocrBarcode",
];

export const EMPTY_SECTION_FORM = {
  name: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

export const SCAN_TABLE_HEADERS = [
  "Date",
  "Section",
  "Barcode",
  "SEW",
  "CUT",
  "SO",
  "LI",
  "Item",
  "Size",
  "Line",
  "Bin",
];
