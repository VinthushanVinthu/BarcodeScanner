import { supabase } from "../supabaseClient";

export async function fetchActiveSections() {
  return supabase
    .from("sections")
    .select("id,name,description,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
}

export async function checkIsAdmin() {
  return supabase.rpc("is_admin");
}

export async function fetchAdminSections() {
  return supabase
    .from("sections")
    .select("id,name,description,is_active,sort_order,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
}

export async function fetchLabelScans() {
  return supabase
    .from("label_scans")
    .select("id,section_id,label_date,created_at,barcode,sew,cut,so,li,ref,vd,sg3,color,item,size,line_num,bin,section:sections(name)")
    .order("label_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
}

export async function saveLabelScan({ selectedSection, barcode, parsedData, rawText, scanDate }) {
  const payload = {
    section_id: selectedSection.id,
    label_date: scanDate || new Date().toISOString().slice(0, 10),
    barcode: barcode || parsedData.ocrBarcode || null,
    sew: parsedData.sew || null,
    cut: parsedData.cut || null,
    so: parsedData.so || null,
    li: parsedData.li || null,
    ref: parsedData.ref || null,
    vd: parsedData.vd || null,
    sg3: parsedData.sg3 || null,
    color: parsedData.color || null,
    item: parsedData.item || null,
    size: parsedData.size || null,
    line_num: parsedData.lineNum || null,
    bin: parsedData.bin || null,
    parsed_data: parsedData,
    raw_text: rawText || null,
  };

  return supabase.from("label_scans").insert(payload);
}

export async function upsertSection(sectionForm, editingSectionId) {
  const payload = {
    name: sectionForm.name.trim(),
    description: sectionForm.description.trim() || null,
    sort_order: Number(sectionForm.sort_order) || 0,
    is_active: Boolean(sectionForm.is_active),
  };

  if (editingSectionId) {
    return supabase.from("sections").update(payload).eq("id", editingSectionId);
  }

  return supabase.from("sections").insert(payload);
}
