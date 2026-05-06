const SUPABASE_URL = 'https://keshhlhhqsarswkrogaj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lx8TAyYqgseeVkkL6g0y0Q_YzYs0FmU'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
    const nameInput = document.getElementById('loginName').value.trim();
    const iinInput = document.getElementById('loginIIN').value.trim();

    if (!nameInput || !iinInput) {
        alert("Атыңызды және ИИН-ді жазыңыз!");
        return;
    }

    try {
        // 406 қатесін болдырмау үшін .select() деп қана аламыз
        const { data, error, status } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('iin', iinInput);

        if (error) {
            console.error("Supabase қатесі:", error);
            alert(`Қате: ${error.message}. Статус: ${status}`);
            return;
        }

        if (!data || data.length === 0) {
            alert("Бұл ИИН базада табылмады!");
            return;
        }

        const user = data[0];
        
        // Базада баған аты 'full_name' екенін тексеріңіз
        const dbName = user.full_name || user.name || ""; 

        if (dbName.toLowerCase() === nameInput.toLowerCase()) {
            localStorage.setItem('finder_user', JSON.stringify({
                id: user.id,
                name: dbName,
                iin: user.iin,
                avatar_url: user.avatar_url
            }));

            alert("Қош келдіңіз!");
            window.location.href = 'index.html';
        } else {
            alert("Енгізілген есім базадағы мәліметпен сәйкес келмейді!");
        }
    } catch (err) {
        console.error("Күтпеген қате:", err);
        alert("Жүйеге кіру кезінде қате шықты.");
    }
}