import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, query, where, updateDoc, doc, increment, addDoc, deleteDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA1gJbICweCK_K5xQQK6iIrfEWfwqatytU",
    authDomain: "hackmode-2e1b1.firebaseapp.com",
    projectId: "hackmode-2e1b1",
    storageBucket: "hackmode-2e1b1.firebasestorage.app",
    messagingSenderId: "961579533174",
    appId: "1:961579533174:web:f59b6a7e1bf7616aed7057"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- GLOBAL UI HELPERS ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
};

window.uiShowToast = function(msg) {
    const container = document.getElementById('ui-toast-container');
    const toast = document.createElement('div');
    toast.className = 'ui-toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent); font-size: 1.2rem;"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
};

const originalAlert = window.alert;
window.alert = function(msg) {
    uiShowToast(msg);
    setTimeout(() => { originalAlert(msg); }, 100); 
};

window.uiFilterTable = function(inputElement, tableId) {
    let filter = inputElement.value.toLowerCase();
    let rows = document.getElementById(tableId).getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        let text = rows[i].textContent || rows[i].innerText;
        rows[i].style.display = text.toLowerCase().indexOf(filter) > -1 ? "" : "none";
    }
};

window.uiCopyText = function(text) {
    navigator.clipboard.writeText(text);
    uiShowToast("Copied to clipboard!");
};

window.uiOpenModal = function(title, contentHtml) {
    document.getElementById('ui-modal-title').innerText = title;
    document.getElementById('ui-modal-content').innerHTML = contentHtml;
    document.getElementById('ui-global-modal').classList.add('show');
};

window.uiCloseModal = function() {
    document.getElementById('ui-global-modal').classList.remove('show');
};

window.uiExportCSV = function(tableId, filename) {
    let csv = [];
    let rows = document.querySelectorAll(`#${tableId} tr`);
    for (let i = 0; i < rows.length; i++) {
        if(rows[i].style.display === "none") continue;
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length - 1; j++) row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        csv.push(row.join(","));
    }
    let link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv.join("\n"));
    link.target = "_blank"; link.download = filename + ".csv"; link.click();
    uiShowToast("Data Exported to CSV");
};

// --- NEW FEATURE: CLEAN TIMESTAMP FORMATTING ---
window.formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Date N/A';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes} ${ampm}`;
};

// --- 1. DEPOSITS ---
onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending")), (snapshot) => {
    let html = '';
    snapshot.forEach((d) => {
        const data = d.data();
        html += `
            <tr>
                <td>
                    <strong style="color:var(--accent)">${data.email}</strong><br>
                    <small style="color:var(--text-muted)">${data.uid}</small>
                    <button class="btn-icon-small" style="margin-left:8px;" onclick="uiCopyText('${data.uid}')" title="Copy UID"><i class="fa-solid fa-copy"></i></button>
                </td>
                <td><span style="font-weight: 600; text-transform: uppercase;">${data.method}</span></td>
                <td style="color:var(--success); font-weight:bold; font-size:1.1rem;">₹${data.amount}</td>
                <td><code>${data.utr}</code> <button class="btn-icon-small" style="margin-left:8px;" onclick="uiCopyText('${data.utr}')" title="Copy UTR"><i class="fa-solid fa-copy"></i></button></td>
                <td class="actions-cell">
                    <button class="btn-success" onclick="approveDeposit('${d.id}', '${data.uid}', ${data.amount})"><i class="fa-solid fa-check"></i> Approve</button>
                    <button class="btn-danger" onclick="rejectDeposit('${d.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                </td>
            </tr>`;
    });
    document.getElementById('deposit-list').innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No pending deposits.</td></tr>';
});

window.approveDeposit = async (docId, uid, amount) => {
    if(!confirm(`Approve this and add ₹${amount} to user's wallet?`)) return;
    try {
        await updateDoc(doc(db, "deposits", docId), { status: 'success' });
        await updateDoc(doc(db, "users", uid), { balance: increment(amount) });
        alert("Deposit Approved! User wallet updated.");
    } catch(e) { alert("Error: " + e.message); }
};

window.rejectDeposit = async (docId) => {
    if(!confirm("Reject this deposit request?")) return;
    await updateDoc(doc(db, "deposits", docId), { status: 'failed' });
};

// --- 2. ORDERS ---
onSnapshot(query(collection(db, "orders"), where("status", "==", "pending")), (snapshot) => {
    let html = '';
    snapshot.forEach((d) => {
        const data = d.data();
        const timeDisplay = data.createdAt ? window.formatTimestamp(data.createdAt) : '<span style="color:var(--text-muted)">Date N/A</span>';
        
        html += `
            <tr>
                <td>
                    <strong style="color:var(--accent)">${data.email}</strong><br>
                    <small style="color:var(--text-muted)">${data.uid}</small>
                    <button class="btn-icon-small" style="margin-left:8px;" onclick="uiCopyText('${data.uid}')"><i class="fa-solid fa-copy"></i></button>
                </td>
                <td><strong style="font-size: 1.05rem;">${data.productName}</strong><br><span style="color:var(--text-muted)">${data.duration}</span></td>
                <td>
                    <div style="color:var(--accent); font-weight: 700; font-size: 1.1rem;">₹${data.price}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;"><i class="fa-regular fa-clock"></i> ${timeDisplay}</div>
                </td>
                <td><input type="text" id="key-${d.id}" placeholder="Enter generated key..."></td>
                <td class="actions-cell">
                    <button onclick="deliverKey('${d.id}')"><i class="fa-solid fa-paper-plane"></i> Send Key</button>
                    <button class="btn-danger" onclick="deleteOrder('${d.id}')" title="Delete Order"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
    document.getElementById('order-list').innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No pending orders.</td></tr>';
});

window.deliverKey = async (docId) => {
    const keyVal = document.getElementById(`key-${docId}`).value;
    if(!keyVal) return alert("Please enter the product key!");
    try {
        await updateDoc(doc(db, "orders", docId), { status: 'success', key: keyVal });
        alert("Key Delivered successfully!");
    } catch(e) { alert("Error: " + e.message); }
};

window.deleteOrder = async (docId) => {
    if(!confirm("Are you sure you want to delete this order permanently?")) return;
    try {
        await deleteDoc(doc(db, "orders", docId));
        alert("Order deleted successfully!");
    } catch(e) { alert("Error: " + e.message); }
};

// --- 3. STORE ---
onSnapshot(collection(db, "products"), (snapshot) => {
    let html = '';
    snapshot.forEach((d) => {
        const data = d.data();
        html += `
            <tr>
                <td><strong style="color:var(--accent); font-size: 1.1rem;">${data.name}</strong></td>
                <td style="font-weight: 600;">₹${data.prices['1']} / ₹${data.prices['7']} / ₹${data.prices['15']} / ₹${data.prices['30']}</td>
                <td>${data.videoUrl !== '#' && data.videoUrl !== '' ? '<span style="color:var(--success); font-weight:700;"><i class="fa-solid fa-video"></i> Yes</span>' : '<span style="color:var(--danger); font-weight:700;"><i class="fa-solid fa-video-slash"></i> No Video</span>'}</td>
                <td class="actions-cell">
                    <button class="btn-outline" onclick='editProduct("${d.id}", ${JSON.stringify(data)})'><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button class="btn-danger" onclick="deleteProduct('${d.id}')"><i class="fa-solid fa-trash"></i> Drop</button>
                </td>
            </tr>`;
    });
    document.getElementById('product-list').innerHTML = html || '<tr><td colspan="4" style="text-align:center;">Store is empty. Add products above.</td></tr>';
});

window.saveProduct = async () => {
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const video = document.getElementById('prod-video').value || "#";
    const p1 = document.getElementById('prod-1').value;
    const p7 = document.getElementById('prod-7').value;
    const p15 = document.getElementById('prod-15').value;
    const p30 = document.getElementById('prod-30').value;

    if(!name || !p1 || !p7 || !p15 || !p30) return alert("Fill Product Name and all 4 Prices!");
    const productData = { name: name, videoUrl: video, prices: { "1": Number(p1), "7": Number(p7), "15": Number(p15), "30": Number(p30) } };

    try {
        if(id) {
            await updateDoc(doc(db, "products", id), productData); 
            alert("Product Updated!");
        } else {
            await addDoc(collection(db, "products"), productData); 
            alert("New Product Added!");
        }
        document.querySelectorAll('#tab-products input').forEach(inp => inp.value = ''); 
        document.getElementById('btn-save-prod').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> SAVE PRODUCT TO STORE';
    } catch(e) { alert("Error: " + e.message); }
};

window.editProduct = (id, data) => {
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = data.name;
    document.getElementById('prod-video').value = data.videoUrl === "#" ? "" : data.videoUrl;
    document.getElementById('prod-1').value = data.prices['1']; document.getElementById('prod-7').value = data.prices['7'];
    document.getElementById('prod-15').value = data.prices['15']; document.getElementById('prod-30').value = data.prices['30'];
    document.getElementById('btn-save-prod').innerHTML = '<i class="fa-solid fa-wrench"></i> UPDATE EXISTING PRODUCT';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async (id) => {
    if(confirm("Delete this product permanently from the store?")) await deleteDoc(doc(db, "products", id));
};

// --- 4. USER MANAGEMENT & NEW HISTORY MODAL ---
onSnapshot(collection(db, "users"), (snapshot) => {
    let html = ''; let totalCount = 0; let activeCount = 0; let bannedCount = 0;

    snapshot.forEach((d) => {
        const data = d.data();
        const isBanned = data.isBanned || false;
        
        totalCount++;
        if(isBanned) bannedCount++; else activeCount++;

        const statusBadge = isBanned ? '<span class="badge banned">BANNED</span>' : '<span class="badge active">ACTIVE</span>';
        const banBtnText = isBanned ? '<i class="fa-solid fa-unlock"></i> Unban' : '<i class="fa-solid fa-ban"></i> Ban Player';
        const banBtnClass = isBanned ? 'btn-success' : 'btn-danger';

        html += `
            <tr>
                <td>
                    <strong style="color:var(--accent)">${data.email}</strong><br>
                    <small style="color:var(--text-muted)">${d.id}</small>
                    <button class="btn-icon-small" style="margin-left:8px;" onclick="uiCopyText('${d.id}')" title="Copy UID"><i class="fa-solid fa-copy"></i></button>
                </td>
                <td style="font-size:1.2rem; font-weight:700;">₹${data.balance || 0}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button class="btn-success" onclick="adjustWallet('${d.id}', 'add')"><i class="fa-solid fa-plus"></i> Add</button>
                    <button class="btn-danger" onclick="adjustWallet('${d.id}', 'minus')"><i class="fa-solid fa-minus"></i> Minus</button>
                </td>
                <td class="actions-cell">
                    <button class="${banBtnClass}" onclick="toggleBan('${d.id}', ${isBanned})">${banBtnText}</button>
                    <button class="btn-danger" onclick="deleteUser('${d.id}')" title="Delete User"><i class="fa-solid fa-user-xmark"></i></button>
                    
                    <button class="btn-outline btn-icon-small" style="padding: 10px;" onclick="viewUserHistory('${d.id}', '${data.email}', ${data.balance || 0}, ${isBanned})" title="View Details & History"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>`;
    });
    
    document.getElementById('user-list').innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
    document.getElementById('stat-total').innerText = totalCount;
    document.getElementById('stat-active').innerText = activeCount;
    document.getElementById('stat-banned').innerText = bannedCount;
});

window.adjustWallet = async (uid, action) => {
    const amtStr = prompt(`Enter amount to ${action === 'add' ? 'ADD to' : 'DEDUCT from'} wallet:`);
    if(!amtStr) return;
    const amt = Number(amtStr);
    if(isNaN(amt) || amt <= 0) return alert("Invalid amount.");
    try {
        await updateDoc(doc(db, "users", uid), { balance: increment(action === 'add' ? amt : -amt) });
        alert(`Successfully ${action === 'add' ? 'added' : 'deducted'} ₹${amt}.`);
    } catch(e) { alert("Error: " + e.message); }
};

window.toggleBan = async (uid, currentlyBanned) => {
    if(!confirm(`Are you sure you want to ${currentlyBanned ? 'UNBAN' : 'BAN'} this player?`)) return;
    try { await updateDoc(doc(db, "users", uid), { isBanned: !currentlyBanned }); } catch(e) { alert("Error: " + e.message); }
};

window.deleteUser = async (uid) => {
    if(!confirm("Are you sure you want to delete this user permanently? This action cannot be undone!")) return;
    try { await deleteDoc(doc(db, "users", uid)); alert("User deleted successfully!"); } catch(e) { alert("Error: " + e.message); }
};

// --- NEW FEATURE: DYNAMIC USER HISTORY MODAL ---
window.viewUserHistory = async (uid, email, balance, isBanned) => {
    // Show Loading Interface First
    uiOpenModal('Player Profile & History', `
        <div style="text-align:center; padding: 40px 20px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--accent);"></i>
            <p style="margin-top: 15px; color: var(--text-muted); font-weight: 600;">Fetching ZEXISTEY FAMILY records...</p>
        </div>
    `);

    try {
        const depositsSnap = await getDocs(query(collection(db, "deposits"), where("uid", "==", uid)));
        const ordersSnap = await getDocs(query(collection(db, "orders"), where("uid", "==", uid)));

        let deposits = []; depositsSnap.forEach(d => deposits.push(d.data()));
        deposits.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let depositsHtml = '';
        deposits.forEach(d => {
            const sc = d.status === 'success' ? 'var(--success)' : (d.status === 'failed' ? 'var(--danger)' : 'var(--accent)');
            depositsHtml += `
                <div class="history-card">
                    <div class="flex-between">
                        <strong style="font-size: 1.1rem;">₹${d.amount}</strong> 
                        <span style="color:${sc}; font-weight:700; text-transform:uppercase; font-size:0.8rem;">${d.status}</span>
                    </div>
                    <div class="flex-between">
                        <small style="color:var(--text-main);">${d.method || 'Unknown'}</small> 
                        <small style="color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${window.formatTimestamp(d.createdAt)}</small>
                    </div>
                </div>`;
        });

        let orders = []; ordersSnap.forEach(o => orders.push(o.data()));
        orders.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let ordersHtml = '';
        orders.forEach(o => {
            ordersHtml += `
                <div class="history-card">
                    <div class="flex-between">
                        <strong style="color:var(--accent); font-size: 1.05rem;">${o.productName}</strong> 
                        <span style="font-weight:bold;">₹${o.price}</span>
                    </div>
                    <div class="flex-between" style="margin-bottom: 8px;">
                        <small style="color:var(--text-main);">Duration: ${o.duration}</small> 
                        <small style="color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${window.formatTimestamp(o.createdAt)}</small>
                    </div>
                    ${o.key ? `<div style="padding:8px; background:rgba(0,0,0,0.4); border-left: 2px solid var(--success); border-radius:4px; font-size:0.85rem; color:var(--success);">Delivered Key: <code style="color:var(--success); background:transparent !important; border:none; padding:0 !important;">${o.key}</code></div>` : ''}
                </div>`;
        });

        const finalHtml = `
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><strong>Email:</strong> <span>${email}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><strong>UID:</strong> <span style="color:var(--text-muted); font-size: 0.9rem;">${uid}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><strong>Wallet:</strong> <span style="color:var(--accent); font-weight: bold;">₹${balance}</span></div>
                <div style="display:flex; justify-content:space-between;"><strong>Status:</strong> ${isBanned ? '<span style="color:var(--danger)">Banned</span>' : '<span style="color:var(--success)">Active</span>'}</div>
            </div>
            
            <div style="max-height: 350px; overflow-y: auto; padding-right: 10px;" class="custom-scrollbar">
                <h4 style="color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px;"><i class="fa-solid fa-money-bill-transfer"></i> Deposit Timeline</h4>
                <div style="display: flex; flex-direction: column; margin-bottom: 25px;">
                    ${depositsHtml || '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">No deposits recorded yet.</p>'}
                </div>

                <h4 style="color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px;"><i class="fa-solid fa-key"></i> Order Timeline</h4>
                <div style="display: flex; flex-direction: column; padding-bottom: 15px;">
                    ${ordersHtml || '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">No orders recorded yet.</p>'}
                </div>
            </div>
        `;
        document.getElementById('ui-modal-content').innerHTML = finalHtml;
    } catch(err) {
        document.getElementById('ui-modal-content').innerHTML = `<p style="color: var(--danger); padding: 20px;">Error fetching history: ${err.message}</p>`;
    }
};
