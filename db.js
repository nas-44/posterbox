// db.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ---------------------------------------------------------
// YOUR SUPABASE CONFIGURATION
// ---------------------------------------------------------
const SUPABASE_URL = 'https://tstxtfkwgljszcklswny.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHh0Zmt3Z2xqc3pja2xzd255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDA5NzYsImV4cCI6MjA4MTIxNjk3Nn0.MHv_-mNvABv52i6gV4LrqKwrajGB2Y4_KcCBO7ibhtM'; // <--- PASTE KEY HERE
// ---------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Convert Base64 to Blob
function base64ToBlob(base64) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

// --- 1. SAVE CAMPAIGN (Dashboard) ---
export async function saveCampaignToCloud(campaign) {
    try {
        // A. Upload Background Image
        const blob = base64ToBlob(campaign.image);
        const fileName = `${campaign.id}_bg.jpg`;

        const { error: uploadError } = await supabase.storage
            .from('posters')
            .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('posters')
            .getPublicUrl(fileName);

        // B. Save Data
        const finalData = { ...campaign, image: publicUrl };
        const { error: dbError } = await supabase
            .from('campaigns')
            .upsert({ id: campaign.id, data: finalData, client: campaign.client }); // Added 'client' column for Admin filtering

        if (dbError) throw dbError;
        return true;
    } catch (e) {
        console.error("Supabase Error:", e);
        alert("Cloud Save Failed: " + e.message);
        return false;
    }
}

// --- 2. GET CAMPAIGN (Generator) ---
export async function getCampaignFromCloud(id) {
    const { data, error } = await supabase
        .from('campaigns')
        .select('data')
        .eq('id', id)
        .single();
    
    if (error) { console.error(error); return null; }
    return data.data;
}

// --- 3. ADMIN FUNCTIONS (New) ---
export async function getAllCampaigns() {
    const { data, error } = await supabase.from('campaigns').select('data');
    if (error) return [];
    return data.map(row => row.data);
}

export async function deleteCampaignCloud(id) {
    await supabase.from('campaigns').delete().eq('id', id);
    await supabase.storage.from('posters').remove([`${id}_bg.jpg`]);
}