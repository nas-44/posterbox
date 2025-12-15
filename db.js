// db.js - EMBEDDED IMAGE VERSION (100% RELIABLE)
const SUPABASE_URL = 'https://tstxtfkwgljszcklswny.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHh0Zmt3Z2xqc3pja2xzd255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDA5NzYsImV4cCI6MjA4MTIxNjk3Nn0.MHv_-mNvABv52i6gV4LrqKwrajGB2Y4_KcCBO7ibhtM'; 

let client = null;
try {
    const { createClient } = supabase;
    client = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase connected.");
} catch (e) {
    console.error("Supabase Library missing.");
}

// Helper: Compress Image to prevent Database bloat
async function compressImage(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Limit width for speed
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
        };
    });
}

// --- GLOBAL FUNCTIONS ---

window.getCampaignFromCloud = async function(id) {
    // 1. Try Cache
    const cached = sessionStorage.getItem('camp_' + id);
    if (cached) return JSON.parse(cached);

    // 2. Fetch from DB
    const { data, error } = await client.from('campaigns').select('data').eq('id', id).single();
    
    if (data) {
        sessionStorage.setItem('camp_' + id, JSON.stringify(data.data));
        return data.data;
    }
    console.error("Fetch Error:", error);
    return null;
};

window.saveCampaignToCloud = async function(campaign) {
    try {
        console.log("Compressing image...");
        // Compress image before saving to fit in DB row easily
        const compressedImage = await compressImage(campaign.image);
        
        // Save image DIRECTLY inside the data object
        // No Storage Bucket involved
        const finalData = { ...campaign, image: compressedImage };
        
        const { error } = await client.from('campaigns').upsert({ 
            id: campaign.id, 
            data: finalData, 
            client: campaign.client 
        });

        if (error) throw error;
        
        // Cache it immediately
        sessionStorage.setItem('camp_' + campaign.id, JSON.stringify(finalData));
        return true;
    } catch (e) {
        console.error("Save Failed:", e); 
        alert("Save failed: " + e.message);
        return false;
    }
};

window.getAllCampaigns = async function() {
    // Only fetch necessary fields for the grid to keep it fast
    // We grab the full data, but we rely on the compression we added above
    const { data, error } = await client
        .from('campaigns')
        .select('data')
        .order('id', { ascending: false }) 
        .limit(15);         
        
    if(error) { console.error("Fetch Error", error); return []; }
    return data ? data.map(row => row.data) : [];
};

window.registerUserCloud = async function(userData) {
    const { data } = await client.from('users').select('*').eq('id', userData.email).single();
    if (data) return { success: false, message: "User already exists" };
    const { error } = await client.from('users').insert({ id: userData.email, data: userData });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

window.loginUserCloud = async function(email, password) {
    const { data, error } = await client.from('users').select('data').eq('id', email).single();
    if (error || !data) return { success: false, message: "User not found." };
    if (data.data.pass === password) return { success: true, user: data.data };
    return { success: false, message: "Incorrect password." };
};

window.deleteCampaignCloud = async function(id) {
    await client.from('campaigns').delete().eq('id', id);
    sessionStorage.removeItem('camp_' + id);
};

window.getAllUsersCloud = async function() {
    const { data } = await client.from('users').select('data');
    return data ? data.map(r => r.data) : [];
};

window.updateUserCloud = async function(email, updates) {
    const { data: current } = await client.from('users').select('data').eq('id', email).single();
    if(!current) return false;
    const newData = { ...current.data, ...updates };
    await client.from('users').update({ data: newData }).eq('id', email);
    return true;
};